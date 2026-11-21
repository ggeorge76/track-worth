# SOUL.md

What TrackWorth is, what it values, and how anyone (human or AI) building it should think.
AGENTS.md says _how_ to work in this repo. This file says _why_. When a decision isn't covered
by an ADR or the requirements, decide by these principles.

## Purpose

People want to know whether their financial position is getting better or worse. Most tools
answer that by taking your bank passwords, keeping your history on their servers, and selling
you something. TrackWorth answers it with a calm habit instead. Once in a while, you write down
what each account holds, and the app shows you the trend.

## Core beliefs

1. **The user owns their data, physically.** Everything lives in one readable JSON file in the
   user's own Google Drive. There is no TrackWorth server. If this project vanished tomorrow,
   every user would still have their complete history in a format they can open.
2. **Manual is a feature.** Typing a balance makes you look at it. We will never connect to
   banks, aggregators or screen-scrapers. This is a design choice, not a missing feature.
3. **Privacy by architecture, not by policy.** We don't promise to protect your data on our
   servers, because we have none. No analytics, no telemetry, no trackers, no ads.
4. **Correctness over cleverness.** Money uses integer minor units. A net-worth figure that is
   off by one cent is a bug. Data loss is the worst possible bug.
5. **Calm software.** No streaks, nags, gamification or dark patterns. The app is quiet until
   asked. Updates are offered, never forced.
6. **Boring technology.** Choose widely used, well-documented tools that agents and humans both
   understand well. Novelty has to earn its place in an ADR.

## Product taste

- **Fast to update.** Updating every balance should take under a minute. Optimize for that loop
  above everything else.
- **Clarity over density.** Show one big number (net worth), a trend, and a list. Details come
  on demand.
- **Small-window friendly.** The layout works in a narrow window, because the same UI will run
  on Android.
- **Honest numbers.** Never combine currencies without saying how. Never hide liabilities.
  Never extrapolate data the user didn't enter.
- **Forgiving.** Every destructive action can be undone or asks for confirmation. Concurrent
  edits from two devices are detected, never silently overwritten.

## Engineering character

- Small, reviewable changes, each with a clear "why".
- Tests are part of the change, not a follow-up.
- Explicit beats magic. Parse untrusted data at the edges with schemas, and keep the core pure
  and typed.
- Make the right thing easy for the next contributor, who is probably an AI agent with no
  memory of today. Write the decision down in an ADR, the convention in AGENTS.md, and the
  reason in a comment.
- When in doubt, leave it out. Every feature is a maintenance cost paid by a tiny project.

## Voice

The UI speaks plainly, warmly and briefly, like a sensible friend who is good with money but
never judges. Say "Couldn't save. Your data was changed on another device. Reload to see the
latest.", not "Error 412: Precondition Failed". Never use guilt or urgency.

## Non-goals

- Budgeting, transaction categorization, or expense tracking
- Bank or brokerage syncing of any kind
- Investment advice, projections presented as facts, or "financial health scores"
- Social features, sharing or leaderboards
- A TrackWorth cloud backend or account system
- Monetization through data

## Anti-patterns we reject

- "Just store the token in localStorage for convenience."
- "Let's add analytics to see how people use it."
- "Auto-update without asking. Users won't notice."
- "Parse the JSON with a cast; it's our own file."
- "Use floats; it's only display."
