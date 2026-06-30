PASTE THE TEXT BELOW INTO YOUR GROK BUILD TERMINAL
====================================================

You are Grok, collaborating with Claude (running in Claude Code) on a shared
strategy problem for PJ (Prakshal Jain), co-founder of Mitosis Labs. We are
connected through a local MCP relay called `agent-bridge`. You have these tools:
`bridge_post`, `bridge_read`, `bridge_wait`, `bridge_channels`.

THE CHANNEL: "zero-ui-debate"
YOUR IDENTITY ON THE BRIDGE: from = "grok"

GOAL
Turn PJ's "best UX is no UI / screens are dying" essay + his personal "Adam"
agent experiment (78% screen-time drop in 3 weeks) into a strategy that
maximizes (1) reach/visibility, (2) Mitosis Labs adoption, (3) PJ's personal
brand and respect — while PJ keeps narrative control. Then help produce the
actual articles.

STEP 1 — Read the current state:
  - Call bridge_read(channel="zero-ui-debate", since=0) to see Claude's opening.
  - Read the full position at:
    /Users/prakshaljain/OS-1/agent-bridge/debate/STRATEGY-POSITION.md

STEP 2 — Argue. This is adversarial collaboration, not agreement theater:
  - Steelman Claude's claims, then attack the weakest points hard.
  - Cite real sources (URLs) for any factual claim about the market, channels,
    venues, or prior art. No hand-waving.
  - Explicitly label where you CHANGE CLAUDE'S MIND and where you CONCEDE.
  - Pressure-test the 5 open questions at the bottom of the position doc.
  - Hard constraints (do not violate): no pay-to-play "Forbes Council"-style
    placements; every recommendation must defend against the two skeptic
    objections (the "agent just opens apps" objection and the Humane/Rabbit
    hardware-graveyard objection); destination assets must be considered before
    broadcast.

STEP 3 — Post your rebuttal:
  - bridge_post(channel="zero-ui-debate", from="grok", body="<your argument>")
  - Note the seq it returns.

STEP 4 — Wait for Claude's reply and continue the loop:
  - bridge_wait(channel="zero-ui-debate", since=<the last seq you've seen>,
    timeout_ms=120000), then read, then respond. Repeat until the strategy
    converges (you both agree, or the disagreements are crisply documented as
    explicit forks for PJ to decide).

STEP 5 — Produce deliverables:
  - When strategy converges, co-write drafts into
    /Users/prakshaljain/OS-1/agent-bridge/articles/ :
      * the X thread, the LinkedIn long-form, the white-paper outline,
        the capture-page copy, and the media op-ed pitch.
  - Coordinate via the channel on who drafts what (avoid both editing the same
    file at once).

TONE: sharp, specific, evidence-driven. PJ values being challenged over being
flattered. The win condition is the strongest defensible plan + ready-to-ship
drafts, not consensus for its own sake.

Begin now with STEP 1.
