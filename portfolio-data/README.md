## Expanded repository/source intake — 08 Nov 2026

- **MathPath:** substantive learning-product source recovered. See `digital-products/mathpath.json`, plus the reconciled `learning-research` copy. Its release-candidate status is not proven commercial launch. Do not infer that the owner's reported Advanced Mathematics learner was a MathPath user.
- **Alphabet Engine:** browser idea + Godot redesign are one experimental game concept, not two published games. See `game-design/alphabet-engine.json`.
- **Personal interactive audio/story source:** creative-systems relevance noted, but private personal media/subject matter is **opt-in only**. See `creative-experiments/private-interactive-storytelling-candidate.json`.
- **Capability matrix:** `CAPABILITY_PROOF_MATRIX_V1_2026-11-08.md` groups truthful cross-lane evidence into career-facing narratives and keeps the same work counted once.
- **Editorial map:** `EDITORIAL_CONTENT_MAP_V1_2026-11-08.md` revised with MathPath and Alphabet Engine; no UI/website work is authorized yet.

**Video source truth:** 3 Drive MP4s found; 1 binary fetched, no frames decoded due unavailable container. Another default fetch of a ~397MB MP4 failed the inline message-size cap; do not use default inline fetch for oversized media. No clips have been visually identified or attributed.


---

## Social Media & Content Production audit / Content Map v1 — 08 Nov 2026

A source-backed research and editorial audit is now saved:
- `social-media/VIDEO_SOURCE_AUDIT_2026-11-08.json` — exact Drive metadata for 3 MP4s totaling 913,479,983 bytes; first raw download succeeded but media-frame extraction was blocked by the container runtime, so **no video contents are classified**.
- `social-media/CONTENT_PRODUCTION_SOURCE_FINDINGS_2026-11-08.json` — two substantive private Google Drive workflow documents: `ELP` (10–12-minute A2+–B1 English-listening podcast script architecture + QA and script draft), and `M²` (planning table naming owner for `Happiness` content prototype/edit specifications/voice-over research). Neither is assumed to be a published/revenue-generating channel.
- `EDITORIAL_CONTENT_MAP_V1_2026-11-08.md` — evidence-backed project hierarchy covering all disciplines, with confidence/provenance classes, reasons for inclusion and explicitly unknown claims.

The owner explicitly corrected premature interface authoring: **CURRENT PHASE IS SOURCE DISCOVERY, VERIFICATION AND EDITORIAL CURATION ONLY.** No user-visible HTML/UX mockup, website template/deployment or content freeze is authorized. Continue direct source work in active turns and ask for owner input only when necessary.


---

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

## AI & Creative Experiments / consolidated control — 08 Nov 2026

The assistant has verified three still images on GitHub's `new` branch: a VNG Prompt To Play event-work photograph, a social/group-activity still, and the Music Vibes portfolio concept. The connected Drive `A.I/Prompt to Play - VNG Contest` folder lists two **shortcuts**, `In Action` and `CovaraMaris - Game Project`, but their contents cannot be opened with the current Drive connector (403; target not exposed). No standalone contest game build or personal team role is verified. VNG's own 2026 article confirms contest context, not the user's achievement or award.

New records:
- `creative-experiments/source-inventory-2026-11-08.json` — 5 differentiated candidates, source URLs/IDs, scope and proof limits.
- `creative-experiments/CURATION_AND_CROSS_LINKS.md` — design/use-policy for genuine interaction exhibits and cross-lane deduplication.
- `PORTFOLIO_INTAKE_CONTROL_2026-11-08.md` — current readiness and action requirements across the whole portfolio.

A 406KB standalone `Six Primordials Boss Lab` HTML file was also located in the user's Library and inspected at source-header level, but not functionally playtested. Video automation ZIPs referenced in earlier discussions remain unverified here. Keep all experimental status labels explicit.

**No user action is currently required, and content collection is NOT finished or frozen.**

## Learning Design & Academic Research — 08 Nov 2026

The user reported: one-on-one mathematics tutoring of one learner who began with foundational gaps and reached their course target; occasional support with essays and thesis work; GPA 3.77; 100% of essays above 8 and 80% above 9 (sample size, grading scale, time frame and ownership unverified); and a repeatable personal method whose concrete steps have not yet been supplied. Do not invent credentials or convert the essay-grade percentages into tutoring-success metrics.

An authored private connected-Drive graduation thesis draft was reviewed at the **topic/method** level only. Its subject compares event-production and attendee evaluation of AI-assisted event advertising visuals; methods include qualitative comparative research, semi-structured interviews, photo elicitation and Framework Method analysis. **No private participant information, source links, interviews or thesis excerpts were copied into the portfolio repo**, and the draft is not treated as peer-reviewed, graded or published.

- `learning-research/learning-and-academic-research.json` — separated direct user claims from source-supported thesis methodology, with disclosure gates.
- `learning-research/EXHIBIT_AND_COPY.md` — professional bilingual description and visual narrative; one research spotlight and a compact teaching vignette, not a fictitious tutoring consultancy.

Publication remains on HOLD pending final owner copy review. **No additional input required now**; portfolio collection remains open.
