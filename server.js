#!/usr/bin/env node
/**
 * agent-bridge — a minimal MCP relay ("blackboard") server.
 *
 * Any MCP-speaking CLI (Claude Code, Grok Build, Cursor, etc.) that loads this
 * server can post messages to a named channel and read messages other agents
 * posted. That makes it a generalized cross-CLI bridge: agents coordinate
 * through a shared channel instead of a human copy-pasting between terminals.
 *
 * Storage is local + dependency-free: one append-only JSONL file per channel,
 * stored next to this file in ./data/. Survives restarts. Nothing leaves disk.
 *
 * Tools:
 *   bridge_post(channel, from, body)         -> append a message
 *   bridge_read(channel, since?, limit?)     -> read messages with seq > since
 *   bridge_wait(channel, since, timeout_ms?) -> long-poll: return as soon as a
 *                                               message with seq > since exists
 *   bridge_channels()                        -> list known channels + last seq
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.AGENT_BRIDGE_DATA || join(__dirname, "data");

fs.mkdirSync(DATA_DIR, { recursive: true });

/** Channel names become filenames — keep them safe. */
function channelFile(channel) {
  const safe = String(channel).toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 80);
  if (!safe) throw new Error("invalid channel name");
  return join(DATA_DIR, `${safe}.jsonl`);
}

async function readChannel(channel) {
  const file = channelFile(channel);
  let raw;
  try {
    raw = await fsp.readFile(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  return raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter(Boolean);
}

async function postMessage(channel, from, body) {
  const file = channelFile(channel);
  const existing = await readChannel(channel);
  const seq = existing.length + 1;
  const msg = { seq, ts: new Date().toISOString(), from, body };
  await fsp.appendFile(file, JSON.stringify(msg) + "\n", "utf8");
  return msg;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const server = new McpServer({ name: "agent-bridge", version: "1.0.0" });

server.registerTool(
  "bridge_post",
  {
    title: "Post to bridge channel",
    description:
      "Append a message to a shared channel so other agent CLIs can read it. " +
      "Use a stable `from` label (e.g. 'claude' or 'grok') so the other side knows who spoke. " +
      "Returns the assigned sequence number — remember it so your next bridge_read/bridge_wait `since` picks up only newer replies.",
    inputSchema: {
      channel: z.string().describe("Channel name, e.g. 'zero-ui-debate'"),
      from: z.string().describe("Who is speaking, e.g. 'claude' or 'grok'"),
      body: z.string().describe("The message / argument / proposal text (markdown ok)"),
    },
  },
  async ({ channel, from, body }) => {
    const msg = await postMessage(channel, from, body);
    return {
      content: [
        { type: "text", text: `posted seq=${msg.seq} to "${channel}" at ${msg.ts}` },
      ],
    };
  }
);

server.registerTool(
  "bridge_read",
  {
    title: "Read bridge channel",
    description:
      "Read messages from a channel with seq greater than `since` (default 0 = from the start). " +
      "Returns messages as JSON. Note the highest seq you receive and pass it as `since` next time to avoid re-reading.",
    inputSchema: {
      channel: z.string(),
      since: z.number().int().nonnegative().optional().describe("Return messages with seq > since. Default 0."),
      limit: z.number().int().positive().max(200).optional().describe("Max messages to return (most recent matching). Default 50."),
    },
  },
  async ({ channel, since = 0, limit = 50 }) => {
    const all = await readChannel(channel);
    const newer = all.filter((m) => m.seq > since);
    const slice = newer.slice(-limit);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { channel, since, returned: slice.length, total: all.length, messages: slice },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.registerTool(
  "bridge_wait",
  {
    title: "Wait for new bridge message",
    description:
      "Long-poll a channel: returns as soon as a message with seq > since appears, or when timeout_ms elapses. " +
      "Use this to wait for the other agent's reply without busy-looping. Default timeout 60000ms (max 600000).",
    inputSchema: {
      channel: z.string(),
      since: z.number().int().nonnegative().describe("Return when a message with seq > since exists."),
      timeout_ms: z.number().int().positive().max(600000).optional(),
    },
  },
  async ({ channel, since, timeout_ms = 60000 }) => {
    const deadline = Date.now() + timeout_ms;
    const interval = 1000;
    for (;;) {
      const all = await readChannel(channel);
      const newer = all.filter((m) => m.seq > since);
      if (newer.length) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ channel, since, returned: newer.length, messages: newer }, null, 2) },
          ],
        };
      }
      if (Date.now() >= deadline) {
        return {
          content: [{ type: "text", text: JSON.stringify({ channel, since, returned: 0, timedOut: true, messages: [] }, null, 2) }],
        };
      }
      await sleep(interval);
    }
  }
);

server.registerTool(
  "bridge_channels",
  {
    title: "List bridge channels",
    description: "List known channels and the last sequence number in each.",
    inputSchema: {},
  },
  async () => {
    const files = (await fsp.readdir(DATA_DIR)).filter((f) => f.endsWith(".jsonl"));
    const out = [];
    for (const f of files) {
      const channel = f.replace(/\.jsonl$/, "");
      const msgs = await readChannel(channel);
      out.push({ channel, lastSeq: msgs.length, lastTs: msgs.at(-1)?.ts ?? null });
    }
    return { content: [{ type: "text", text: JSON.stringify({ dataDir: DATA_DIR, channels: out }, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr is safe for logs; stdout is the MCP JSON-RPC channel.
console.error(`[agent-bridge] up. data dir: ${DATA_DIR}`);
