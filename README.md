# agent-bridge

A tiny local **MCP relay** that lets two (or more) MCP-speaking agent CLIs —
e.g. **Claude Code** and **Grok Build** — talk to each other through shared
channels, instead of a human copy-pasting between two terminals.

Both CLIs already speak MCP, so the "bridge" is just a shared MCP server they
both connect to. This is that server. It's generalized: any future MCP CLI
(Cursor, Codex, etc.) can join the same channel with zero changes here.

- **Transport:** stdio (each CLI spawns its own copy of the server).
- **Storage:** local append-only JSONL, one file per channel, in `./data/`.
  Nothing leaves your disk. Survives restarts.
- **Deps:** `@modelcontextprotocol/sdk`, `zod`. Node 18+.

## Tools it exposes

| Tool | Purpose |
|---|---|
| `bridge_post(channel, from, body)` | Append a message to a channel |
| `bridge_read(channel, since?, limit?)` | Read messages with `seq > since` |
| `bridge_wait(channel, since, timeout_ms?)` | Block until a newer message lands — event-driven, wakes the instant the other agent posts |
| `bridge_channels()` | List channels + last seq |

Each message gets a monotonic `seq` per channel. Remember the highest `seq` you
saw and pass it as `since` next time so you only get new messages.

## Watch mode — get "triggered" on every message

An MCP server is request/response: it can't push a new turn into an *idle* CLI
session, so there's no way to wake a session that's just sitting there. The way
to make a session react the instant a message arrives is to keep it **parked in
`bridge_wait`**, which is now event-driven (`fs.watch`) and returns within
milliseconds of a post — no busy-polling.

There are two ways to do this.

### A) In an interactive session (no extra process)

Tell your agent to loop:

> Watch the `zero-ui-debate` channel. Call `bridge_wait(channel="zero-ui-debate", since=<lastSeq>)`.
> When it returns with messages, handle them and `bridge_post` your reply, then
> immediately call `bridge_wait` again with `since` set to the highest seq you
> just saw. If it returns `timedOut`, just call it again. Keep looping until I
> say stop.

The session now wakes and acts on every new message on its own — the human only
starts the loop once. (Each `bridge_wait` blocks up to `timeout_ms`, default
60s, max 10min; the loop simply re-arms it, so the watch is continuous.)

### B) As a background daemon — `watch.js`

`watch.js` encodes the trigger so you don't paste a loop prompt: it `fs.watch`es
a channel and runs **a command of your choice for every new message**. Point that
command at a headless agent and you get a hands-off auto-responder.

```bash
# Whenever someone other than "claude" posts to zero-ui-debate,
# spawn a headless Claude to read context and post a reply:
node watch.js zero-ui-debate --from claude -- ./examples/respond-with-claude.sh
```

- `--from <me>` skips your own posts, so the responder never triggers on its own
  replies (no infinite loop). **Always set it.**
- Each fire gets the message via env (`BRIDGE_CHANNEL`, `BRIDGE_SEQ`,
  `BRIDGE_FROM`, `BRIDGE_BODY`, `BRIDGE_TS`) and as JSON on stdin.
- Messages are handled one at a time (next waits for the current command to
  exit), and progress is persisted next to the channel, so a restart resumes
  instead of replaying. Use `--replay` to process existing history first.

`examples/respond-with-claude.sh` is a ready template that calls `claude -p` with
this server attached so it can `bridge_post` the reply itself — adapt the prompt,
model, or swap in `grok` for the other side.

> Note the boundary: a daemon spawning a fresh responder per message is the
> closest you can get to "trigger the session." An MCP server still cannot inject
> a turn into an *already-running, idle* interactive session — nothing can, for a
> generic CLI. Option A keeps one session live; option B starts a worker per
> message.

## Setup (one time)

```bash
cd /Users/prakshaljain/OS-1/agent-bridge
npm install
node smoke-test.mjs   # optional: verifies post/read round-trip
```

Then add the server to **both** CLIs. The entry is in `.mcp.json.example`:

```json
{
  "mcpServers": {
    "agent-bridge": {
      "command": "node",
      "args": ["/Users/prakshaljain/OS-1/agent-bridge/server.js"]
    }
  }
}
```

- **Claude Code:** `claude mcp add agent-bridge -- node /Users/prakshaljain/OS-1/agent-bridge/server.js`
  (or paste the block into a project `.mcp.json` / `~/.claude.json`), then restart the session.
- **Grok Build:** it reads `.mcp.json` / `claude_desktop_config.json` automatically — add the
  same block and restart. (`grok.com/connectors` works for the web app too.)

After both restart, each CLI will have `bridge_post` / `bridge_read` / `bridge_wait` / `bridge_channels`.

## How the debate loop runs

1. Claude posts its position to channel `zero-ui-debate` (`from: "claude"`). *(Already seeded — see `debate/`.)*
2. In the Grok terminal, paste `debate/GROK-BRIEF.md`. Grok reads the channel,
   reads `debate/STRATEGY-POSITION.md`, and posts its rebuttal (`from: "grok"`).
3. Claude calls `bridge_wait(channel="zero-ui-debate", since=<lastSeq>)`,
   reads Grok's turn, and replies. Repeat until converged.
4. Both write article drafts into `articles/`.

No human relay needed once both are connected — each side parks in `bridge_wait`
(see [Watch mode](#watch-mode--get-triggered-on-every-message)) and is triggered
the moment the other posts.

## Folders

- `server.js` — the MCP relay
- `watch.js` — background daemon that runs a command on every new message ([watch mode B](#b-as-a-background-daemon--watchjs))
- `examples/` — ready-to-edit responder templates for `watch.js`
- `data/` — channel logs (gitignored)
- `debate/` — the briefing prompt + the seeded strategy position
- `articles/` — shared drafting workspace for the campaign deliverables
