# Khánh Port — Single Control Tower / 12 Nov 2026 (ICT)
**Authority:** Source + actual `index.html`/ship standalone + running Chromium/Metal evidence outrank chat summaries. This document records issues and freeze boundaries, not a claim of release.

## Release condition
Goal: complete the portfolio today, but **do not certify completion on promises or smoke checks**. Release only when real source media, project identities, UI paths, visual parity and frame pacing are evidenced. A feature may be READY, HOLD or SOURCE-ONLY, never silently counted as done.

## Golden surfaces / no arbitrary degradation
- **Main Stage case study** (Stage, `stage/ShowSystem.tsx`, show data, lighting, video/cinema evidence): already final by product owner. Freeze animations, shader, case-study presentation, real photo provenance. Do not modify in generic panel experiments.
- **Ship-first boot** merged via PR #5 at `09774cc`. Must not show legacy ORBITA loader, island map flash, fake percentage, or unrecoverable load.
- **HEX/UEH** PR #7, DRAFT/HOLD. Prior 18/18 native Metal source pixel parity for batching; actual cold-open 5–10s hitches remain. Not accepted.
- **Beacon** PR #6, DRAFT/HOLD. Six real-light experiment lowers some after-click gaps, but idle spans 9–30s; not accepted.

## Inventory and destination decisions
| Area | Product meaning | Source status | Current action |
|---|---|---|---|
| Spaceship cockpit | First-pass overview, identity, strongest examples and route to island | Verified ship-first entry; cockpit project/CV overview now authored in PR #15 | #8, #12; CV-grounded UEH/Sen Viet and no falsely completed degree |
| Main Stage | Event case studies with actual footage/photographs | Owner-final | FROZEN |
| Colossus robot | APEX CHAOS, Ragnarok, Alphabet Engine, Prompt to Play | Real game repos; owner's CV says VNGGames 2026 Top 26, 24h puzzle RPG (self-reported) | #10; demo/source, contest proof |
| VNG Work Gallery | VNG competition entry, brief/process/evidence (NOT employment) | 3D kiosk and four truthful VNGGames 2026 slide labels drafted; photo library available but public rights/visibility not verified | #10; new dossier entry and assets to verify |
| Cinema | Reel, video post-production, social shorts, TikTok Quê Quá Quao | 3D film simulation; personal media/URL missing | #10; verified reels only, no fabricated results |
| Piano | Full-instrument music production and audio-reactive visualizer | Interactive piano exists; personal mastered song media missing | #10; must not pretend ambient piano plays completed song |
| Product Lab | EventFlow Pro, MathPath, ORBITA, Alphabet Engine and browser game source | Five real project identity cards implemented in PR #15; private EventFlow/MathPath source cannot link publicly | #11; replace all five concept previews with verified identities |
| Rubik | Skills, education, project process, certificates | CV-based UEH Event Management 2023–2026 expected, Sen Viet internship and dated AI-generated visual communication thesis now drafted | #12; verified dates/degrees only |
| Orb | AI-assisted creative method | 3D orb exists; old panel fictional lighting company | #8, #9; map genuine process examples |
| Beacon | Honest, working contact CTA | Verified personal CV contact details now drafted; no false inbox/SLA | #8, #10; working CV-based mailto, telephone and LinkedIn |

## Workstreams, dependency graph, priorities
- **P0 #8** AUTH/TRUTH (all public copy and links depend on this).
- **P1 #9** DOSSIER UX (layout & accessibility); depends on stable `PanelContent` interface, not missing media.
- **P1 #10** GAME/VNG/MUSIC/VIDEO/SOCIAL/CONTACT MEDIA; may build catalog before audio/video deliveries, cannot certify missing media.
- **P1 #11** WEB/PLATFORM PRODUCTS; can independently map five hologram items after source verification.
- **P1 #12** RUBIK/SHIP OVERVIEW; relies on CV proof only for degree/job claims, not on other workstreams.
- **P0 #13** PERFORMANCE: separate HEX + Beacon + boot FPS A/B. Independent of content. Do not let compositor hooks, screenshot or prewarm artifacts contaminate timings.
- **P0 #14** RELEASE/ACCEPTANCE depends on ALL #8–13 + real hosted HTML.

**Branches:** no editing production main directly. Each PR has source ownership. `#15 feat/portfolio-source-truth-20261112` is CONTENT+UI+PRODUCT preview initial implementation, unmerged until real standalone and visual evidence pass. #6/#7 stay separate. Do not overlap source file owners without rebasing/pinning tested SHAs.

## Evidence and no-fake-content policy
Reviewed repo names: `Khanh-glitch/Kh-nh-port`, `eventflow-pro`, `MathPath`, `APEX-CHAOS`, `Soul-of-Hero`, `alphabet-engine`. `eventflow-pro` and `MathPath` are PRIVATE: never expose their GitHub URL as a publicly accessible CTA. EventFlow README states tested browser-local product demo, explicitly **NOT production-ready**. Personal `qu-sn-ts` project contains real portraits/family audio and MUST NOT be promoted without consent. Personal Library CV verifies owner-provided UEH 2023–2026 (expected, NOT award of degree), Sen Viet Event Production Intern, VNGGames Prompt To Play 2026 Top 26 and 24h puzzle-RPG as SELF-REPORTED. Oct 26 2026 thesis cover corroborates academic work. Professional contact email/phone/LinkedIn recorded from owner's CV and used with portfolio intent. Official VNG organizer ranking evidence, public contestant footage, accessible video, TikTok URL, publishable full-track audio and degree conferral remain NOT independently verified. Do not publish student ID, participant interview data, private family audio or nonpublic Drive folder IDs.
Only claim complete when deployed media source and legal permission are demonstrated.

## Actual acceptance matrix for #14
1. First paint real ship, no ORBITA loader or map flash; real island WebGL ready, retry/fallback verified.
2. Every exhibit click opens appropriate original scene/panel; source references and CTA work; not clipped at 390x844 / 1280x720 / 1920x1080. ESC/close/reopen repeat.
3. Five hologram screens match five **real** project dossiers. VNG competition dossier reachable. Main Stage source render/pixel evidence unchanged.
4. Video/audio playback real (not decorative), correct user gesture and licensing; TikTok URL and identity verified.
5. HEX cold-first/return/retrigger and Beacon full six-icon signal/return/retrigger pass native GPU no-click and after-click frame-pacing acceptance. No huge stall moved into entry or pre-click.
6. Source SHA pinned against exact published `index.html` plus `assets/immersive/index.html`, Cloudflare deployment inspected, final visual captures reviewed.
7. Final report states each section ACCEPT, HOLD with blocker + current commit + exact next action. No 'all done' claim if any hard gate is failing.
