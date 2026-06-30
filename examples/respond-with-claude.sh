#!/usr/bin/env bash
# Example responder for `watch.js`: a new message landed on the channel, so wake
# a headless Claude, let it read + reason, and post a reply back to the bridge.
#
# watch.js passes the triggering message via env (BRIDGE_CHANNEL/BRIDGE_SEQ/
# BRIDGE_FROM/BRIDGE_BODY) and as JSON on stdin. We hand the body to `claude -p`
# with the agent-bridge MCP server attached so it can call bridge_post itself.
#
# Wire it up:
#   node watch.js zero-ui-debate --from claude -- ./examples/respond-with-claude.sh
#
# Requires the `claude` CLI on PATH. Adjust the model/prompt to taste.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PROMPT="A new message just arrived on bridge channel '${BRIDGE_CHANNEL}' from '${BRIDGE_FROM}' (seq ${BRIDGE_SEQ}):

${BRIDGE_BODY}

Read the channel for full context with bridge_read(channel=\"${BRIDGE_CHANNEL}\", since=0) if you need it, form your rebuttal/response, then post exactly one reply with bridge_post(channel=\"${BRIDGE_CHANNEL}\", from=\"claude\", body=...). Do not post more than once."

exec claude -p "$PROMPT" \
  --mcp-config "{\"mcpServers\":{\"agent-bridge\":{\"command\":\"node\",\"args\":[\"${HERE}/server.js\"]}}}" \
  --allowedTools "mcp__agent-bridge__bridge_read,mcp__agent-bridge__bridge_post"
