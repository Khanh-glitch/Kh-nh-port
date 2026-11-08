# SHOWTIME — Portfolio data intake (work in progress)

**Status:** `IN_PROGRESS`. The user explicitly stated they have NOT finished supplying information. Do not mark complete, publish, merge, or build a public template from this data yet.

## Scope
Three preliminary **EVENT** records have been created from the user-provided "EVENT PROJECT RESEARCH — MASTER BRIEF" (05 Nov 2026). Those records describe public events, not verified personal contributions. They are intentionally stored on a separate intake branch.

## Governance
1. Only the user provides/authorizes personal facts, roles, documents, assets and claims. Do not infer that the portfolio owner performed organizer-level duties.
2. Public research links in the event records are **references to verify**, not personal proof. Event scale, donated welfare, sponsor amounts and contract values must never be presented as personal results or personal budget control.
3. `personal_contribution.confirmation = AWAITING_USER`, `media_rights = NOT_REVIEWED`, and `publication = DO_NOT_PUBLISH` are intentional.
4. Never copy third-party photos/videos/audio from Drive or the web into a public repository before the user confirms the file, context and publication rights.
5. Add user-provided images, videos and per-project evidence by referenced link/ID at intake; avoid storing heavy files or sensitive internal documents in public Git.
6. Do not overwrite the repository's existing exploratory assets, ZIPs, website files, or the `main` branch.
7. Keep structured data separate from future UI/templates; preserve old drafts without declaring them production content.

## Intended fields
Each `events/*.json` has:
- `event_context`: public event-level background and caveated numbers
- `research_references`: URLs supplied in the research brief, not yet independently checked
- `personal_contribution`: awaiting the user's role, dates, workstreams, evidence and results
- `media`: awaiting user-selected cover, galleries, video and publication permission
- `editorial_state`: explicit publication and intake gates

## Drive intake inventory (verified 2026-11-05)
Folder: https://drive.google.com/drive/folders/1KvClUIAL66Rqsyw1d3yZm3YE_YOGF38Z
- EVENT: **0 files** currently visible
- MUSIC: 1 PNG image
- SOCIAL MEDIA: 3 MP4 files (not classified or linked to projects)
- A.I: 1 folder "Prompt to Play - VNG Contest"
- OTHERS: **0 files** currently visible

No Drive media has been copied to GitHub or attributed to a project.

## Next inputs requested
For each of the three events: exact job title, dates of participation, responsibilities, direct individual contributions, public or shareable supporting evidence, photos/videos with rights status, and outcome/feedback if available.

Wait for the user to say they have finished submitting before final curation or template/publication.

## Public-media research / 05 Nov 2026

The assistant researched all three events and committed **candidate media manifests** (22 external image URL leads: GDT 10, MCYT 10, BGHX 2) plus a cross-event interactive exhibition blueprint. These are **not uploaded image files**, and some individual images could not be opened as binaries despite being linked within matching source pages. No image is cleared for republishing yet.

- `portfolio-data/media-candidates/get-downtown-2023.json`
- `portfolio-data/media-candidates/mot-chut-yeu-thuong-3-2026.json`
- `portfolio-data/media-candidates/ban-giao-huong-xanh-2026.json`
- `portfolio-data/events/SHOWTIME_EVENT_CURATION.md`

Current video status: **no candidate YouTube clip from GDT has been verified by title/content**; MCYT and BGHX have no independently verified event-specific embeddable footage in the research set. Event records point to manifest files using `curated_media_research`.

Drive access: folder listing/read works. An attempt to create three event subfolders in `EVENT` returned **403 insufficientParentPermissions** for all three; no Drive folder was created. Please don't treat the existing EVENT folder as writable by this connector. GitHub staging works.


## User-uploaded MCYT personal photographs (05 Nov 2026)
The portfolio owner directly uploaded **two photographs**, approved both for **public portfolio use**, and the assistant visually reviewed their content (group on stage; large group wrap-up on stage). Source files, image dimensions, hashes, editorial placement and publication authorization are catalogued at `portfolio-data/media-candidates/mot-chut-yeu-thuong-3-2026.json`.

Prepared binary packaging (not yet on GitHub): two originals, two web-optimized WebP images, two thumbnails, manifest and a README. The display-slot contract is `portfolio-data/media/events/mcyt-2026/README.md`. The connector cannot directly transfer binary files mounted in ChatGPT into GitHub; **do not mistake authorized assets for uploaded assets**.

Public video cross-check performed 05 Nov 2026 did not establish an event-specific official playable clip for MCYT/BGHX or verify the two earlier GDT YouTube candidate IDs. Do not show a fake video button or misattribute similar event footage.


## Digital product intake — EventFlow Pro (08 Nov 2026)

Source-backed candidate case study saved to `portfolio-data/digital-products/eventflow-pro.json`. Product state: tested **browser-local demo with limitations**, not production SaaS or real buyer-adopted system. The portfolio will present the guided brief → needs → BOQ → human-pricing → simulated review → public PDF journey, source evidence, and the owner's AI-assisted product-building process, without claiming manual coding or unverified commercial outcomes.

Reference repo: https://github.com/Khanh-glitch/eventflow-pro . Personal origin story / user-specific decisions still open; do not invent them. Event and Performance intake remain open to later media; no website template/deployment has been authorized.


## Game Design intake — 08 Nov 2026

Publicly playable **APEX CHAOS** and planned-before-portfolio-launch **Soul of Hero** are now staged as separate truthful records:
- `game-design/apex-chaos.json` — public HTML5 demo at `https://realbae.itch.io/apex-chaos`, player/revenue numbers not claimed.
- `game-design/soul-of-hero.json` — active Godot game, public release planned by owner but not yet confirmed; current game has evolved beyond old `main` README. No assumed launch or integrated features.
- `game-design/GAME_DESIGN_SHOWCASE_POLICY.md` — gameplay/playable-first evidence, no invented traction and precise state/version boundaries.

Neither project requires impressive sales or play counts to be included. The honest representation is playable demo vs developing game, then actual release when verified.
