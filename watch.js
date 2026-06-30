#!/usr/bin/env node
/**
 * watch.js — fire a command whenever a new message lands on a bridge channel.
 *
 * An MCP server is request/response: it can't push a turn into an idle CLI
 * session. This daemon closes that gap from the outside — it watches a channel's
 * JSONL file (event-driven via fs.watch) and, for each new message, spawns a
 * command of your choice. Point that command at a headless agent and you get a
 * true auto-trigger: the other agent posts -> your side wakes and responds.
 *
 * Usage:
 *   node watch.js <channel> [--from <me>] [--since <n>] [--replay] [--data <dir>] -- <command> [args...]
 *
 *   --from <me>   Skip messages whose `from` equals <me> (case-insensitive), so a
 *                 responder never triggers on its own replies. Strongly recommended.
 *   --since <n>   Start after seq <n>. Default: the channel's current end (only
 *                 future messages fire). Use --replay for --since 0.
 *   --replay      Process the whole existing channel history first, then live.
 *   --data <dir>  Channel data dir. Default: $AGENT_BRIDGE_DATA or ./data.
 *
 * For each fired message the command receives:
 *   - env: BRIDGE_CHANNEL, BRIDGE_SEQ, BRIDGE_FROM, BRIDGE_BODY, BRIDGE_TS
 *   - stdin: the full message as one line of JSON
 *
 * Messages are processed strictly one at a time (the next waits for the current
 * command to exit), so a responder is never run concurrently against itself and
 * replies stay ordered. Progress is persisted next to the channel, so a restart
 * resumes where it left off instead of replaying or skipping.
 *
 * Example — Claude auto-responds to Grok on the debate channel:
 *   node watch.js zero-ui-debate --from claude -- ./examples/respond-with-claude.sh
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const dashdash = argv.indexOf("--");
if (dashdash === -1 || dashdash === argv.length - 1) {
  console.error("usage: node watch.js <channel> [--from me] [--since n] [--replay] [--data dir] -- <command> [args...]");
  process.exit(2);
}
const head = argv.slice(0, dashdash);
const command = argv.slice(dashdash + 1);

let channel = null;
let me = null;
let sinceArg = null;
let replay = false;
let dataDir = process.env.AGENT_BRIDGE_DATA || join(__dirname, "data");

for (let i = 0; i < head.length; i++) {
  const a = head[i];
  if (a === "--from") me = head[++i];
  else if (a === "--since") sinceArg = Number(head[++i]);
  else if (a === "--replay") replay = true;
  else if (a === "--data") dataDir = head[++i];
  else if (!channel && !a.startsWith("--")) channel = a;
  else {
    console.error(`unexpected argument: ${a}`);
    process.exit(2);
  }
}
if (!channel) {
  console.error("missing <channel>");
  process.exit(2);
}

// ---- channel io (mirrors server.js, kept dependency-free) -----------------
function safeName(name) {
  const safe = String(name).toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 80);
  if (!safe) throw new Error("invalid channel name");
  return safe;
}
const safeChannel = safeName(channel);
const channelFile = join(dataDir, `${safeChannel}.jsonl`);
const stateFile = join(dataDir, `.watch.${safeChannel}.${me ? safeName(me) : "all"}.seq`);

fs.mkdirSync(dataDir, { recursive: true });

async function readChannel() {
  let raw;
  try {
    raw = await fsp.readFile(channelFile, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  return raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

// ---- progress -------------------------------------------------------------
async function loadCursor() {
  if (replay) return 0;
  if (Number.isFinite(sinceArg)) return sinceArg;
  try {
    const v = Number(await fsp.readFile(stateFile, "utf8"));
    if (Number.isFinite(v)) return v;
  } catch { /* no prior state */ }
  // Default: skip existing history, only fire on future messages.
  const all = await readChannel();
  return all.length ? all[all.length - 1].seq : 0;
}
async function saveCursor(seq) {
  try { await fsp.writeFile(stateFile, String(seq), "utf8"); } catch { /* best effort */ }
}

// ---- run one message ------------------------------------------------------
function runCommand(msg) {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: ["pipe", "inherit", "inherit"],
      env: {
        ...process.env,
        BRIDGE_CHANNEL: channel,
        BRIDGE_SEQ: String(msg.seq),
        BRIDGE_FROM: msg.from ?? "",
        BRIDGE_BODY: msg.body ?? "",
        BRIDGE_TS: msg.ts ?? "",
      },
    });
    child.on("error", (e) => {
      console.error(`[watch] command failed to start: ${e.message}`);
      resolve();
    });
    child.on("close", (code) => {
      if (code) console.error(`[watch] command exited ${code} for seq=${msg.seq}`);
      resolve();
    });
    child.stdin.end(JSON.stringify(msg) + "\n");
  });
}

// ---- serial drain loop ----------------------------------------------------
let cursor = await loadCursor();
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      const all = await readChannel();
      const next = all.find(
        (m) => m.seq > cursor && !(me && String(m.from).toLowerCase() === me.toLowerCase())
      );
      // Advance the cursor past any skipped (own) messages so we don't re-scan them.
      const skipTo = all.filter((m) => m.seq > cursor).map((m) => m.seq);
      if (!next) {
        if (skipTo.length) { cursor = Math.max(...skipTo); await saveCursor(cursor); }
        break;
      }
      console.error(`[watch] firing for seq=${next.seq} from=${next.from}`);
      await runCommand(next);
      cursor = next.seq;
      await saveCursor(cursor);
    }
  } finally {
    draining = false;
  }
}

// ---- arm watcher ----------------------------------------------------------
console.error(
  `[watch] channel="${channel}" from=${me ?? "(any)"} cursor=${cursor} -> ${command.join(" ")}`
);

try {
  fs.watch(dataDir, (_event, filename) => {
    if (!filename || filename === `${safeChannel}.jsonl`) drain();
  });
} catch (e) {
  console.error(`[watch] fs.watch unavailable (${e.message}); relying on safety poll`);
}
// Safety poll for filesystems where fs.watch drops events.
setInterval(drain, 2000);
// Catch anything already pending (e.g. --replay, or posts during startup).
drain();
