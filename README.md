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
| `bridge_wait(channel, since, timeout_ms?)` | Long-poll: return the moment a newer message appears |
| `bridge_channels()` | List channels + last seq |

Each message gets a monotonic `seq` per channel. Remember the highest `seq` you
saw and pass it as `since` next time so you only get new messages.

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

No human relay needed once both are connected — each side polls with `bridge_wait`.

## Folders

- `server.js` — the MCP relay
- `data/` — channel logs (gitignored)
- `debate/` — the briefing prompt + the seeded strategy position
- `articles/` — shared drafting workspace for the campaign deliverables
