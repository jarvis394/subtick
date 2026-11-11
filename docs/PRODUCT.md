# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Players:** a small circle of friends who play CS2 together. Each links their Steam account once and gives access to their match history. After that they come back to see what subtick found and clipped from the matches they played.
- **Host / admin:** the one person who self-hosts the instance, usually on a homelab, for themselves and those friends. They manage users, storage, and the recorder machines from **Manage instance** (Users, Storage, Recorders).

The instance is private to the group, with no public audience.

## Product Purpose

subtick turns a group's CS2 matches into watchable highlight clips with no manual work. New matches are picked up from Steam match history, their demos are parsed for moments worth watching, and a recorder renders those moments into video clips that players can watch and share.

Success: a player links Steam once, and after every session their best moments are waiting as finished clips.

## Positioning

The core differences, all four confirmed:

1. **Fully automatic.** Link Steam once and every new match is parsed and clipped. Players install nothing and upload nothing.
2. **Real in-game renders.** Clips are rendered from the demo inside CS2 itself, through HLAE at a fixed 60 fps. They are not screen captures, so a slow GPU makes recording slower but never choppier.
3. **Self-hosted and owned.** The group's own instance, storage (S3), and recorder machines, with no third-party platform.
4. **Smart moment detection.** A rich highlight taxonomy picks what's worth watching. Kinds: ace, clutch, quad, triple, collateral, double, special, single. Kill tags include headshot, wallbang, smoke, noscope, blind, airborne, flick, long shot, eco, and low HP. Moment tags include opening.

## Operating Context

- People use it on desktop and phone equally. Desktop is for browsing matches, scoreboards, round timelines, and player profiles. The phone is for watching and sharing clips.
- Core flows:
  - Setup: connect Steam, then give access to match history.
  - The highlights feed, with kind tabs and highlight filters, including the player picker.
  - Match pages with the scoreboard and round timeline, plus creating highlights from a match.
  - Sessions: matches grouped by sitting, viewed from any teammate's point of view.
  - The clip viewer, player profiles, and per-player highlights.
  - The recording queue.
  - Settings, and the admin pages.
- Clips go through these statuses: candidate → queued → recorded / skipped / failed. Recording runs per match, in demo order, on a fleet of GPU recorders that may be on different machines. A failed recording can be retried.

## Capabilities and Constraints

- Monorepo apps: `web` (React, TanStack Router, Tailwind), `api`, `parser` (demo parsing and highlight detection), `steam` (match-history worker), and `recorder` (CS2 + HLAE under Wine on an NVIDIA GPU).
- Clip throughput depends on the GPU. The reference recorder is a GTX 650 (1 GB), so clips can take a while to appear. The UI must handle queued, in-progress, and failed states well.
- Accounts use email sign-up and sign-in. Steam is linked as a separate step.
- Terms: highlight / moment, clip, match, round, kill tag, recorder, instance.

## Brand Commitments

- The name is **subtick**, always lowercase. There is a wordmark component (`apps/web/src/components/wordmark.tsx`) and `apps/web/public/favicon.svg`.
- Voice, as seen in the current copy: plain, short, direct, and friendly ("Two steps, then new matches are picked up and clipped automatically."). It uses curly apostrophes.

## Evidence on Hand

- Real product data lives in the instance: matches, highlights, clips, and players. There are no testimonials, user counts, benchmarks, or press, and future work must not invent any.

## Product Principles

1. **Zero ongoing effort.** After setup, players never have to do anything to get clips. Manual actions such as creating highlights or retrying are an option, never a requirement.
2. **The clip is the payoff.** Every surface leads toward watching or sharing a moment.
3. **Honest about the pipeline.** Recording is slow and can fail on modest hardware. Show real status and real progress, and recover gracefully.
4. **Built for a group that knows each other.** The friends play together, so shared matches, other players' moments, and a host who runs the box are normal parts of the product.
