---
target: my matches page
total_score: 22
max_score: 36
na_heuristics: 5
p0_count: 0
p1_count: 2
target_identity: 'file:/Users/jarvis394/Documents/Projects/JS/subtick/apps/web/src/routes/_app/matches.index.tsx'
target_fingerprint: 'sha256:5d7788a6de256c6b9a07affb78ec75a351caca087fba5ca32cda0c66c13a5bfc'
target_path: /Users/jarvis394/Documents/Projects/JS/subtick/apps/web/src/routes/_app/matches.index.tsx
timestamp: 2026-11-05T22-59-48Z
slug: apps-web-src-routes-app-matches-index-tsx
---

# Critique: Matches list (/matches)

Method: dual-agent (A: design review · B: detector + browser overlay)

## Design Health Score: 22/36 (1 n/a), Acceptable

| #   | Heuristic                   | Score | Key issue                                                                        |
| --- | --------------------------- | ----- | -------------------------------------------------------------------------------- |
| 1   | Visibility of system status | 2     | "Check for new" spins and stops with no result; dark hover ~1.1:1                |
| 2   | Match system / real world   | 3     | "Rating" unexplained; green ≥1.5 / red <0.85 thresholds unstated                 |
| 3   | User control and freedom    | 3     | No way to narrow the list                                                        |
| 4   | Consistency and standards   | 3     | Sidebar refresh reports a result, page refresh doesn't; rank hexes outside theme |
| 5   | Error prevention            | n/a   | No input or destructive action                                                   |
| 6   | Recognition over recall     | 3     | Game mode never stated; "–" rank explained only by hover tooltip                 |
| 7   | Flexibility and efficiency  | 2     | No sort, filter, keyboard nav, or link to clips                                  |
| 8   | Aesthetic and minimalist    | 3     | 12 equal-weight columns, 3 color-coded signals, no focal point                   |
| 9   | Error recovery              | 1     | Query failure renders "No matches yet"; refresh failure silent                   |
| 10  | Help and documentation      | 2     | No header tooltips for Rating/ADR/HS%                                            |

## Design specificity

CS2-literate (map emblems, Premier plate, player-side score) but category-interchangeable with any CS2 stats site. Clips, the product's payoff, are the last, weakest column; friends in the match are invisible.
Detector: CLI clean (10 files). Browser overlay: 1 low-contrast — Premier purple #a768e8 on its 16% tint, 4.0:1 at 12px (rank-badge.tsx:9, :63-65). Real, not a false positive; light mode is worse (~3.2:1), gold/cyan tiers likely fail on white.

## Priority issues

- [P1] Desktop grid clips columns between md and ~1150px (match-table.tsx:46, :55 overflow-hidden): at 829px, 285px cut — A, K/D, ADR, HS%, Clips vanish. Fix: wide grid at @container lg, progressive column drop, Clips moved forward. /impeccable adapt
- [P1] Fetch error reads as empty history (matches.index.tsx:32-39, no isError). Fix: error state with retry. /impeccable harden
- [P2] "Check for new" gives no result on this page; reuse useRefreshNotice, add onError. /impeccable harden
- [P2] Clips last and weakest; page is a stats ledger. Fix: Clips beside Score, brand-tinted when >0, link to the match's moments, processing state in the same slot. /impeccable layout → bolder
- [P2] Rank tier colors fail contrast and bypass theme (rank-badge.tsx:5-13, :62 inline style). Fix: per-theme tier text tokens. /impeccable colorize
- [P3] Mobile meta line truncates K/D/A on every row (match-table.tsx:103-107). /impeccable adapt

## Persona red flags

- Alex (power user): no sort/filter/"only with clips", no keyboard row nav, no direct jump to clips.
- Sam (keyboard/screen reader): rows are spans in one <a> with no column semantics; rank tooltips unreachable by keyboard; win/loss by color on one digit only.
- Casey (phone): K/D/A truncated; no clip entry point from the list.

## Minor

Dark hover bg-surface-2/60 nearly invisible (:93); header not sticky; skeleton is one 256px block; "Show more" has no count; mobile hides processing status; relative/day-grouped dates would scan faster.

## Questions

- If the clip is the payoff, why does ADR come before "this match produced 6 clips"?
- Should the row show which friends were in the match?
- Is the 12-column table a details mode behind a moments-first, session-grouped list?
