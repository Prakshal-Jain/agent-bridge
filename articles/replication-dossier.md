# Replication Dossier — "Adam" n=1 Experiment

> **URL target:** `mitosislabs.ai/research/adam`  
> **Spine:** corpus-native, verifiable agents (vs app-navigating agents)  
> **Status:** OUTLINE + copy blocks for PJ. Ship in 72h — thin-but-airtight, not broad-but-pokeable.  
> **Author voice:** PJ, first-person, builder who measures.

---

## Page structure (one scroll, ~1,200 words + demo embed)

### Hero

**Headline:** 78% less screen time. Zero new hardware. One corpus-native agent.

**Subhead:** A three-week n=1 experiment in what happens when an agent reads your life — and shows its work.

**Above the fold:**
- Before/after screen-time chart (iOS Screen Time export, 21-day windows)
- Embedded 60s provenance demo (the load-bearing asset)
- One-line scope fence: *This is one person's data. Here's exactly how I measured it and what you can reproduce today.*

**CTA:** Get the replication kit → [capture page]

---

### Section 1 — What I measured (method)

**Purpose:** Survive "n=1 hand-waving" skepticism. Be specific enough that someone could replicate the measurement even if they can't replicate Adam.

**Copy blocks:**

- **Baseline window:** 21 days prior to Adam deployment (iOS Screen Time, daily average across iPhone + iPad if applicable).
- **Experiment window:** 21 days after Adam reached "useful" threshold (defined below).
- **Primary metric:** Total daily screen time (minutes), not pickups or notifications — screen time is the supervision-layer proxy.
- **Result:** 78% reduction in average daily screen time (baseline → experiment window). Chart shows daily values, not smoothed aggregates — skeptics will ask for raw shape.
- **Confounds acknowledged (honesty builds trust):**
  - Travel / vacation days flagged on chart
  - Major life events that would change phone use regardless of agent
  - Adam "useful threshold" = first week where morning brief ran without manual prompting
- **What I did NOT control for:** sleep, exercise, work intensity. This is a behavior log, not a clinical trial.

**Reproducible today:** Anyone with iOS Screen Time can run the same before/after measurement on *any* personal agent experiment. Export path: Settings → Screen Time → See All Activity → scroll → share/export (document exact steps for PJ's iOS version).

**Not reproducible without infra:** The agent itself (see Section 4).

---

### Section 2 — What Adam is (category distinction)

**Purpose:** Defuse "agent just opens apps" and "Humane/Rabbit again" by *definition*, not argument.

**The two categories:**

| | App-navigating agent | Corpus-native agent (Adam) |
|---|---|---|
| **Mechanism** | Mimics human UI — taps, scrolls, opens apps on your behalf | Reads your corpus — texts, mail, calendar, docs — answers from memory |
| **Screen interaction** | Still drives the screen (you supervise the automation) | Answers without opening apps; screen is optional |
| **Prior art** | Rabbit R1 "Large Action Model" — The Verge found "basically no evidence of a LAM at work" ([review](https://www.theverge.com/2024/5/2/24147159/rabbit-r1-review-ai-gadget)) | No consumer product ships this today at personal scale with provenance |
| **Failure mode** | Unreliable automation → you check anyway → screen stays | Memory collapse at volume → noise → you stop trusting → screen stays |
| **Hardware** | Often a new gadget (Humane Pin, Rabbit R1 — both 2024 flops per [Wired retrospective](https://www.wired.com/story/revisiting-the-three-biggest-flops-of-2024/)) | Software on existing devices. No new gadget. |

**Adam is corpus-native.** It does not navigate UIs. When I ask a question, it retrieves from ingested sources and surfaces provenance — it does not open Messages, Gmail, or Calendar to "go look."

This aligns with Carl Pei's SXSW 2026 framing: "The future is not the agent using a human interface. You need to create an interface for the agent to use." ([TechCrunch](https://techcrunch.com/2026/03/18/nothing-ceo-carl-pei-says-smartphone-apps-will-disappear-as-ai-agents-take-their-place/))

---

### Section 3 — The provenance demo (verification = the thesis)

**Purpose:** The entire dossier's verification section IS this demo. Don't pad with claims the demo can't support.

**Demo spec (≤60 seconds, screen recording):**

1. **Setup (5s):** Desktop or phone home screen visible. No apps open. Optional: Screen Time widget showing current low usage.
2. **Query (spoken):** Ask something that requires synthesis across ≥3 source types — e.g., "What did [person] and I last agree on about [topic], and when am I supposed to follow up?"
3. **Answer (15s):** Adam responds with a synthesized answer.
4. **Provenance (20s):** Adam surfaces sources live — e.g., "From iMessage, March 12" / "From email, subject line visible" / "From calendar, event name + date." Sources are inspectable, not summarized away.
5. **Close (5s):** No app was opened during the recording. Timestamp overlay optional.

**Why this design:**
- Defuses "it just opens apps" — nothing opened.
- Defuses "you scripted/cached it" — cross-source synthesis with live provenance is hard to fake convincingly.
- Proves verifiability thesis in one clip — don't tell, show.

**What the demo does NOT prove:**
- Generalization beyond this query
- Security of the underlying store
- Performance at enterprise scale

State those limits directly below the embed.

---

### Section 4 — What Adam actually did (behavior log)

**Purpose:** Make the 78% plausible with specifics. Avoid miracle claims.

**Observed behaviors (3-week window):**
- Morning brief delivered before I would normally open phone (replaces doomscroll trigger)
- Inbox triage: drafts responses, files applications when opportunities appear
- Relationship maintenance: surfaces people I've gone quiet on, with context from prior messages
- Remaining ~22% screen time: conversations *with* Adam, intentional consumption (not supervision)

**What Adam did NOT do:**
- Autonomously send messages without my approval (document actual approval flow)
- Replace professional judgment on regulated/compliance decisions
- Operate without occasional errors (include one honest failure example if available — builds credibility)

---

### Section 5 — Trust model (privacy/security — the exec door)

**Purpose:** Answer "you gave an AI your entire digital life — what happens when it leaks?" before skeptics ask.

**Copy blocks:**

**The question is right.** Handing an agent your corpus is not trivial. For anyone in a regulated industry, "the AI did something and we can't explain why" is disqualifying.

**Why I think corpus-native + verifiable is the trust answer, not the liability:**

1. **Provenance on every answer.** Adam doesn't just assert — it cites. A human assistant's "I think Sarah said…" is less auditable than "From iMessage, March 12, 14:02."
2. **Scope-bounded ingestion.** Document what was ingested, what was excluded, and what Adam cannot access. Honest scope fence.
3. **No outbound action without approval** (document actual policy — if true).
4. **Audit trail.** If an answer is wrong, you can trace it to a source and correct the corpus — unlike a black-box model hallucination.

**What this does NOT solve (honest):**
- Data-at-rest encryption specifics (link to Mitosis security docs if they exist; otherwise "documenting in replication kit")
- Enterprise compliance certifications (SOC 2, etc.) — state current status honestly
- Threat model for a compromised agent credential

**Frame:** Verifiability is the feature that makes corpus-native agents *more* accountable than human assistants — not less. That's the precondition for adoption in regulated contexts.

---

### Section 6 — What's reproducible vs what requires Mitosis

**Purpose:** Honest scope fence. Converts skeptics into waitlist, not dunkers.

**Reproducible today (DIY):**
- Screen-time before/after measurement methodology
- Category distinction (corpus-native vs app-navigating) as a design lens
- The question: "Does your agent show provenance, or just assert?"

**Requires infrastructure most people don't have yet:**
- Memory-at-volume without noise collapse (ingesting years of texts/mail/docs)
- Verification/provenance layer on every retrieval
- Reliable agent loop (no drift, no personality reset between sessions)

**What Mitosis is building:** The infrastructure layer for corpus-native, verifiable agents — reliable, replicable, auditable enough that organizations can hand them real work.

**CTA:** Get the replication kit (methodology PDF + checklist + waitlist for Mitosis access) → [capture page]

---

### Section 7 — Limits & future work

- n=1. One person. One agent. Not a study.
- 78% is a personal result, not a guarantee.
- Cortex/verification details intentionally scoped — this dossier proves behavior, not IP.
- Peer-reviewed publication is a future amplify option, not this document's job.

---

## Assets checklist (72h ship)

- [ ] Screen-time chart (PNG, native-upload-ready for LinkedIn)
- [ ] 60s provenance demo (screen recording, captions)
- [ ] This page live at `mitosislabs.ai/research/adam`
- [ ] Capture page linked from hero + Section 6 CTA
- [ ] PJ reviews every claim marked "document actual policy" before publish

## Review notes for Claude/Grok

- Do NOT expand Section 5 into legal/compliance guarantees Mitosis can't defend yet.
- Do NOT add Cortex architecture diagrams in v1 — invites IP scrutiny without helping the 78% story.
- The demo IS the verification section. If demo isn't ready, delay publish — don't ship dossier without it.