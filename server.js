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
 *   bridge_wait(channel, since, timeout_ms?) -> block until a message with
 *                                               seq > since lands (event-driven
 *                                               via fs.watch) or timeout elapses
 *   bridge_channels()                        -> list known channels + last seq
 *
 * Getting "triggered" on every message: an MCP server can't push into an idle
 * CLI session, so instead have the agent park in bridge_wait and loop — it
 * returns the instant a message lands. See "watch mode" in the README.
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

/**
 * Block until a message with seq > since exists in `channel`, or timeout_ms
 * elapses. Event-driven: fs.watch on the data dir wakes us the instant the
 * channel file is created or appended to. A slow safety poll covers the rare
 * filesystems where fs.watch drops events (e.g. some network mounts).
 * Resolves to the array of new messages, or null on timeout.
 */
function waitForMessage(channel, since, timeout_ms) {
  return new Promise((resolve) => {
    let settled = false;
    let watcher = null;
    let poll = null;
    let timer = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (watcher) watcher.close();
      if (poll) clearInterval(poll);
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    const check = async () => {
      try {
        const all = await readChannel(channel);
        const newer = all.filter((m) => m.seq > since);
        if (newer.length) finish(newer);
      } catch {
        /* transient read race during append — next tick retries */
      }
    };

    // Watch the directory (not the file): the channel file may not exist yet,
    // and dir-level watch catches both its creation and later appends.
    try {
      watcher = fs.watch(DATA_DIR, () => check());
    } catch {
      /* fs.watch unsupported here — the safety poll below carries us */
    }
    poll = setInterval(check, 2000);
    timer = setTimeout(() => finish(null), timeout_ms);

    // Fast path: a message may already be waiting before we armed the watcher.
    check();
  });
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
      "Block until a message with seq > since lands (event-driven — wakes the instant the other agent posts), or until timeout_ms elapses. " +
      "Default timeout 60000ms (max 600000). " +
      "WATCH MODE — to get 'triggered' on every message instead of waiting once: after this returns, handle the message(s), optionally bridge_post a reply, then immediately call bridge_wait again with `since` set to the highest seq you just saw. On a timeout (returned=0), just call it again. Keep looping to stay parked on the channel.",
    inputSchema: {
      channel: z.string(),
      since: z.number().int().nonnegative().describe("Return when a message with seq > since exists."),
      timeout_ms: z.number().int().positive().max(600000).optional(),
    },
  },
  async ({ channel, since, timeout_ms = 60000 }) => {
    const newer = await waitForMessage(channel, since, timeout_ms);
    if (newer) {
      return {
        content: [
          { type: "text", text: JSON.stringify({ channel, since, returned: newer.length, messages: newer }, null, 2) },
        ],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ channel, since, returned: 0, timedOut: true, messages: [] }, null, 2) }],
    };
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
