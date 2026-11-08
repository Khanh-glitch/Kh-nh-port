# SHOWTIME — Portfolio content handoff

**Current stage:** Content ready for integration into a future web template. **NOT deployed, merged, or publication-approved.**  
**Approved visual territory:** **B — Signal / Cue Room**.  
**Identity:** SHOWTIME — creative production, content, live events, music, interactive products and research.

## 1. Start here (one reader-facing content authority)

### [SHOWTIME_SITE_CONTENT_V1.json](SHOWTIME_SITE_CONTENT_V1.json)

This is the **single renderer-facing portfolio content file**. Use this to populate the future website; **do not parse old research logs into cards**, duplicate works across sections, or use fake sample portfolio content.

The file contains:
- **Home:** identity, edited bilingual opening copy, 6 prioritized real projects.
- **Work directory:** 6 themed sections (live events; film/content; games/interactive; digital products; music/performance; research/experiments) and filter membership.
- **Work detail:** 25 uniquely identified records with stable slugs, VI/EN headlines, descriptions, contribution/role, outcomes with evidence basis, links/media, related work, statuses and source paths.
- **About:** edited bilingual personal narrative, five capability groupings grounded in actual works, verified public-profile links.
- **Contact:** explicit disabled state; no real professional email/contact endpoint supplied. **Do not invent one.**

Of the 25 works: 6 featured, 13 selected, 5 archive, 1 hold. **Show featured+selected by default, allow archive only by explicit choice, never publish hold.** Tier means editorial priority, NOT publication permission.

## 2. How to integrate into any template

All content is plain UTF-8 JSON with **no dependency on React, Vite, Next.js, WebGL or any UI framework**.

Suggested logical mapping (not a design requirement):

| Rendered destination | Data path |
| --- | --- |
| Identity / home lead | `site.identity`, `pages.home` |
| Home selected-work collection | `pages.home.featured_work_ids` → `works[].id` |
| Full project directory / filters | `sections[]`, `pages.work_index`, `works[].section` |
| Project detail page | `works[].slug` at `/work/:slug` |
| Backstage / credits | `works[].role`, `contributions[]`, `detail` |
| Proof / external work | `works[].links`, `outcome.basis`, `source_files` |
| About / capability clusters | `pages.about` |
| Cross-project transitions | `works[].related` (stable IDs) |

Field convention:
- `{vi, en}`: choose current language, fallback to `vi` if needed.
- `section`: each work has **one primary section**. `related` only adds cross-links; it is not duplicate project ownership.
- `tier`: `featured` / `selected` / `archive` / `hold`.
- `status`: exact factual lifecycle, e.g. `playable_demo`, `published_music`, `active_development`, `release_candidate_not_commercially_verified`. **Translate these appropriately**; never turn `active_development` into “Launched”.
- `outcome.basis`: `owner_reported` requires a human-readable qualification; a public artifact is not proof of revenue or impact.
- `media[].thumbnail_url: null` or `binary_in_repository:false`: **do not render a broken image**. Use the original `links[]` when available; wait until an actual owned/approved image is mounted.
- `links[].kind`: distinguishes source/demo/listen/official publication/event-context links.
- `review[]`: internal editorial cautions, **not public-facing copy**. They are necessary for safe content staging and future review.

**Video/music policy:** no short edits or showreels. Originals remain intact; use official source/embed where rights allow. No synthetic screenshots of game/app output. Re-link to Drive/TikTok when embedding is unavailable rather than silently replacing real content with stock images.

**Template integration acceptance:** every featured card should open its real detail; the full directory should include all featured/selected works; filters should not duplicate projects; VI/EN should be readable; source URLs must work or fail gracefully; absent images must not break layout; contact must not display invented details; the visual treatment must honor B without becoming fake sci-fi HUD.

## 3. Original evidence and editorial research (not competing site copy)

- [SHOWTIME_EDITORIAL_MASTER_V1.md](SHOWTIME_EDITORIAL_MASTER_V1.md): expanded narrative, source reasoning and detailed case-copy background. If site text conflicts, update the renderer JSON after checking this and the original source.
- [SHOWTIME_EXPERIENCE_BLUEPRINT_V1.md](SHOWTIME_EXPERIENCE_BLUEPRINT_V1.md): Frontstage / Backstage / Proof, quick recruiter access vs free exploration, native media and user-initiated audio.
- [SHOWTIME_VISUAL_IDENTITY_SPEC_B_V1.md](SHOWTIME_VISUAL_IDENTITY_SPEC_B_V1.md): **current, owner-approved direction B**; palette, timing and type values inside remain proposals for artistic testing.
- [SHOWTIME_ART_DIRECTION_RESEARCH_V1.md](SHOWTIME_ART_DIRECTION_RESEARCH_V1.md): comparison of original A/B/C options; **the old A recommendation is superseded**.
- [PORTFOLIO_INTAKE_CONTROL_2026-11-08.md](PORTFOLIO_INTAKE_CONTROL_2026-11-08.md): short latest-stage control file.
- Topic folders `events/`, `social-media/`, `game-design/`, `digital-products/`, `music-performance/`, `creative-experiments/`, `learning-research/`: **source records, original link registers, media rights and audit provenance**.
- `EDITORIAL_CONTENT_MAP_V1_2026-11-08.md` and `CAPABILITY_PROOF_MATRIX_V1_2026-11-08.md`: earlier synthesis; kept for history, **not a second site-content system**.

## 4. Accurate blockers, not busywork

- Real media binaries for stage/event photos are **not in GitHub**. The catalog notes candidates, not available web assets. Some images require photographer/third-party rights checks.
- Several Drive MP4s are identified by metadata but **not visually/audio reviewed**. Copy follows owner-reported project contributions and does not claim a quality audit.
- MathPath and EventFlow do not have a confirmed public final-runtime deployment; Ragnarok: The Last Island is still developing.
- No verified direct professional contact destination; do **not** display a broken Contact CTA. Add one after the owner supplies an approved address/profile.
- TikTok ~1.1M views and 4K+ followers are owner-reported, not independent current analytics.
- Private gifts, respondents' data, unpublished interview transcripts and unknown-rights assets are **not** renderer content.

**Do not create or publish a finished website from this handoff automatically.** It is the canonical data input for the next beautiful template.
