# SHOWTIME — Visual Identity Specification v1
## LOCKED CONCEPT B · SIGNAL / CUE ROOM
**Owner decision:** 08 Nov 2026 — **B selected** after directly experiencing the referenced Sculpting Harmony work.  
**Scope:** art direction / identity system / motion philosophy. **No UI, HTML, site implementation, logo render, speculative screenshots or publication is authorized.**
**Source hierarchy:** `SHOWTIME_EDITORIAL_MASTER_V1.md` for work claims; `SHOWTIME_EXPERIENCE_BLUEPRINT_V1.md` for Frontstage / Backstage / Proof and visitor journeys; `SHOWTIME_ART_DIRECTION_RESEARCH_V1.md` for external benchmarks. This specification **supersedes the research document's former preference for A**.

### 1. Identity decision

**Signal / Cue Room** is **not** a visual imitation of a sound desk, software dashboard, theatre mixing console or videogame HUD. It is a coherent creative identity based on *precise signals, deliberate timing, readable evidence, sequencing and dramatic transitions*. The audience should feel that each project is part of one authored production.

The user liked **Sculpting Harmony** in its actual live experience. We should borrow its *level of intentionality and source-driven interaction*, not its shapes, drawings, archive, intellectual property or a claim that it literally looks like a control room.

**One-sentence principle:** `CONTROL THE FRAME. LET THE WORK SPEAK.`

**Creative voice:** exacting, theatrical through timing rather than decorative stage props; contemporary, tactile, personal, experimental, confident but not corporate.

**Differentiation:** The site can feel curated with the discipline of a production cue sheet, while still allowing spontaneous discovery and full-strength creative work. It is **a person's creative universe**, not a generic portfolio SaaS, startup landing page or developer résumé.

**Do not revert to** the previous A-centered plan. Cinematic theatrical imagery can be used as work-originating atmosphere in performances, but **B owns the global graphic grammar**. C's clarity is a universal usability requirement, not a competing aesthetic identity.

### 2. The three layers remain; their art treatment changes

- **FRONTSTAGE / OUTPUT:** original work gets maximum visual authority; no global shader/gradient that degrades it. Media-native aspect ratios, full-length video/audio, legitimate links/embeds, real game and product capture. A project can temporarily *break the house palette* by showing its own imagery.
- **BACKSTAGE / PROCESS:** genuine scripts, actual timelines, role cards, shoot constraints, cue notes, source versions, gameplay process and design discussions. Graphics are calibrated and purposeful; no fabricated timestamps, fake audio waveforms, operational telemetry or ornamental stage-manager jargon.
- **PROOF / SOURCE:** clean editorial typography, obvious source provenance, verified vs owner-reported status, project-specific role and actual release status. Avoid visual competition with primary creative artifacts.

**Two visitor speeds:** quick access to 2+ tangible artifacts in ~30 seconds vs exploratory depth. No required 3D hub, forced intro, puzzle, long loading sequence or audio autoplay. This is a *future product acceptance target*, not a measured result.

### 3. Formal visual signature — five ingredients

**3.1 The Cue Line (unique brand primitive)**  
A thin, controlled typographic/graphic stroke that signals a transition in *attention* (not a fake literal production cue). It can underline the current exhibit, separate genuine process from output, or organize a sequence. It should not draw dozens of horizontal lines for decoration. One line means one meaningful shift.

**3.2 The Field / Frame**  
The main frame is a neutral, quiet field where real photo, 9:16 TikTok, 16:9 film, pixel game, music art or product screenshot can remain native. Edge shape is consistent and neutral. No fake brushed-metal frame, CRT treatment, glare, mask shaped like a film reel, or gratuitous border-radius system.

**3.3 Precision Typography**  
The signature is **large, editorial but measured display type** contrasted against precise body/source labeling; no hacker terminal type, pseudo-system boot log or giant paragraphs of monospace. A performance case can use a full-size title and quiet credits; a product case can use metadata and clean diagrams.

**3.4 Authentic Contrast**  
Real content can be wildly colorful: TikTok, magenta stage photography, pixel arts, app screenshots, score pages. Surrounding chrome should stay neutral; one signal hue activates **only the user-directed point of focus**. No duotone treatment forced on the work.

**3.5 Choreography Through State**  
Transitions feel like a decisive stage cue: focus enters, signal marks it, surrounding detail recedes. A sequence of subtle moves carries rhythm; there is no perpetual motion or artificial light show. Interactions and content navigation remain reversible.

### 4. Provisional art tokens — candidates for later visual tests, not approved render values

| Token | Draft value | Job | Constraint |
|---|---|---|---|
| Core-ink | `#14181C` | Neutral dark foundation; technical precision without pure black | Text contrast needs real testing |
| Stage-paper | `#F0EEE5` | Counter-surface for long-form case reading and sources | Do not assume full site is always dark |
| Primary-light | `#F5F2EA` | On dark field | Avoid low-contrast thin lettering |
| Process-muted | `#B5C0C3` | Secondary type / structural separators | Reduce opacity only after contrast verification |
| Signal-coral | `#FA784E` | *One* active cue / focus indicator | For big active contrast; avoid using coral for body text on pale paper |
| Deep-slate | `#242B31` | Process layer / graphic depth | Not a translucent glass backdrop |
| Source-ink | `#242527` | Text on light documentation fields | Aim AA contrast ≥ 4.5:1 for regular body text |

**Palette discipline:** neutral / paper / signal is the *system*. Authentic project media supplies additional colors. The signal coral is a **candidate**, not approved brand equity; color-only semantics are prohibited. Avoid yellow/red alert semantics for normal visual accents.

**Typography candidates to test (not font choices locked):**
- **Display:** a modern grotesk with distinctive but controlled letterforms. Test with “SHOWTIME”, “Ragnarok: The Last Island”, “Một Chút Yêu Thương”, “Que Quá Quao”. Possible starting points: Space Grotesk/Manrope; verify proper Vietnamese glyphs and commercial embedding licenses before use.
- **Narrative:** neutral sans such as Inter-style humanist/neo-grotesk for medium-length Vietnamese and English copy. Body first, no overlong high-contrast headline faces.
- **Source notation:** selective IBM Plex Mono-style monospaced captions for exact technical tokens/dates/version **only when factual**. No faux code for every title.
- **Vietnamese QA:** test ă â ê ô ơ ư đ plus all combined accents at display weights, lowercase/uppercase, italic, mobile, and links.

**Proposed composition rhythm:** large work surface → one decisive heading → compact direct contribution → optional source/document context. The design *may* use density when the information is real; 10 tiny KPI chips do not replace a single meaningful original artifact. Typography and image edges should be more memorable than borders, glow or ornament.

### 5. Motion direction — a system, not a showreel

| Motion event | Intended meaning | Initial test range (not fixed) |
|---|---|---|
| Focus/cue indicator | Which work or mode is active | 100–180 ms, snappy and reversible |
| Change of case context | Switch exhibit with spatial continuity | 240–420 ms, not forced when direct opening is faster |
| Reveal of backstage proof | More detail only on deliberate request | 180–300 ms |
| Continuous passive motion | No purpose | **Do not implement** |
| Work playing/reading | Let artifact speak | Global surrounding animations settle / pause |
| Reduced motion | Preserve meaning without movement | Static or instant state, preserve navigation |

**Non-negotiable:** `prefers-reduced-motion`, no sudden flash/strobe, no compulsory preloader, no motion delaying click-through. Audio starts only by user interaction. Use motion to *route attention*, not cover latency. Transitions must be non-blocking and interruptible.

**Motion syntax:** a cue line lands, the current field changes priority, the new work gains focus. The **real project** may be animated naturally through its own gameplay or video; surrounding identity should become calm.

### 6. How B is applied to the actual portfolio

| Work cluster | What should visually lead | Meaningful cue / process detail | What must NOT happen |
|---|---|---|---|
| **Que Quá Quao** | Actual original [1.1M-view TikTok post](https://www.tiktok.com/@quequaquao/video/7530989283956559122); native vertical full-length format | Honest 4K+ followers and ~1.1M view **owner-reported**, script/edit/voice/channel operations | No fabricated TikTok dashboard, sales funnel or commission figures |
| **China Town, Museum, Crowd, VEINORA** | Original full-length video in true aspect | Source role labels: project lead, editor, VO, on-camera or experiment design **as applicable** | No clips/montage, no client-campaign inflation |
| **Narration + Ads/Promote/OOH** | Original voice examples and four full spec promo videos | Distinct genre, editing and concept credits when true | No fictional billboard placement or media-buying ROI |
| **Event production** | Actual stage and event photos; real selections can be made later | Authentic stage-side readiness/radio cues, GDT preparation; proof from real event reports | No fabricated show-call timeline or job title “overall stage manager” |
| **Music/performance** | Source photographs `NHP_0440.jpg`, Spotify song / Reel original | Separate vocalist and composer credit, clear actual stage context | No forced equalizer/VU animation or unauthorized audio hosting |
| **APEX CHAOS** | Real public [playable game](https://realbae.itch.io/apex-chaos), native game art and pixel fidelity | True game systems, creative direction, AI-assisted development | No game HUD as the website's global art direction |
| **MathPath** | Real source/version-correct product evidence; legible teaching surfaces | Journey, skill state, grading integrity, test evidence *with version* | No fake student reviews, commercial enrollment or sampled marks |
| **Ragnarok: The Last Island** | True development evidence now; accepted playable build if later released | Design-system depth and versioned progress when verified | No outdated legacy screenshot sold as shipped final |
| **EventFlow** | Honest history of brief/BOQ/review, then current rebuild when accepted | Actual event-process reasoning and build provenance | No enterprise deployment claims or copied fake UI |

**Project-to-project links must be based on a real transferable skill**: events → EventFlow, social → commercial video → VO, stage → released music, MathPath → learning/research, APEX → Ragnarok. Do not make every case cross-reference every other case.

### 7. Personal signature without treating the creator as a corporation

The asset-first identity avoids faux brand authority. Distinguish:
- **SHOWTIME** is the exhibition title, not an incorporated production company.
- Work can be credited as creator / lead / vocalist / editor / project contributor with verified or owner-confirmed role as appropriate.
- “AI-assisted” is a real production method, not something to hide or a license to claim hand-coded engineering expertise.
- Project statuses in descriptive copy should remain *Published*, *Playable demo*, *Documented prototype*, *Release candidate*, *Active development* or *Private study* when evidence supports them.

**Wordmark/graphic motif direction — without drawing logos:** prefer typographic name **SHOWTIME** with a very intentional cue/breakpoint/sequential timing concept in the rhythm of letter-spacing or adjacent motif. Avoid a literal play triangle, RGB glitch logo, concert spotlight, five overlapping circles or an imitation of Getty/Resn marks. Test distinctiveness and legibility at small sizes before finalizing the mark.

**Photographic direction:** stage/performance stills should keep their original light, skin tones and context; crop only where useful with source identity intact. Do not insert synthetic crew/performer scenes.

### 8. Explicit rejections

1. Full-screen fake control panel; coding terminal; random pseudo-metrics; noisy fake scopes.
2. Cyberpunk neon gradients, holographic glassmorphism, giant circular HUD rings, “sci-fi command center” rendering.
3. Black-on-black cinematic luxury template with preloader longer than content.
4. Generic white museum index with the media reduced to uniform thumbnails.
5. Obligatory 3D scene and physics controls to access source work.
6. Auto-edited trailers or trimmed original films; owner has rejected clipping.
7. Universal color filter that overwrites native project visuals.
8. Fake “commercial impact”, artificial stage attendance stats, claiming untested prototypes are released, or publishing private research/personally identifying assets.

### 9. Later production acceptance: tests to apply before any visual build is approved

**Identity**
- Someone unfamiliar with the creator sees an authored production/exhibition, not a SaaS product or résumé PDF.
- “Signal” exists as one functional visual cue and typography system; no random decorative technical notation.
- The same visual grammar can frame stage photography and MathPath without modifying their native aesthetics.

**Evidence**
- A recruiter can reach an original TikTok, playable APEX, event proof or official music in about 30 seconds without audio or mandatory animation.
- Work formats preserved: 9:16, 16:9, full films/songs, pixel game, reading content, proper external link fallbacks.
- Backstage clearly distinguishes owner contribution, source, test/release status, date/uncertainty where needed.

**Production/accessibility**
- Standard body contrast ≥ 4.5:1, large text ≥ 3:1 as applicable; meaningful statuses not color-only.
- Vietnamese display texts fully legible and correctly accented.
- Motion can be disabled; browser/low-power mobile works without advanced graphics.
- Loading and film posters don't create compulsory waits or silent media failures.
- Original media rights, confidentiality and permission checked before hosting/embedding.

**Rights & ethical attribution**
- No reuse of actual Getty, Siena, Thyssen, Bruno Simon, makemepulse or studio proprietary design elements as SHO WTIME assets.
- No unauthorized third-party audio redistribution, private student submissions or thesis interview transcript publication.

### 10. What is locked vs what remains to art-test

**LOCKED by owner:**
- **B — Signal / Cue Room** is the selected art-direction *territory*.
- Original media stays full-length; still photos may be selected.
- Site content comes from the evidence-backed Editorial Master, and Frontstage / Backstage / Proof model still governs access.
- No UI build or HTML has been requested.

**PROVISIONAL proposals, to be tested in a later visual identity round:**
- Cue-line motif, coral accent, graphite/paper palette, type families, exact pacing values and brand mark.
- These are **design hypotheses** inside the chosen B territory, not new owner-approved microdecisions.
- Real screenshot/media compositing tests and mobile readability can invalidate token choices without changing the approved **B** concept.

**NEXT:** asset-grounded Visual Identity explorations **only when owner authorizes visual design**, or continue nonvisual content/rights prep in parallel. Do not sneak in mockups under the name “specification”.

### References
- Source inspiration: [Sculpting Harmony — Getty × Resn](https://gehry.getty.edu/) and [Communication Arts source description](https://www.commarts.com/webpicks/sculpting-harmony). The original experience's visual forms must **not** be copied.
- Experience model: `SHOWTIME_EXPERIENCE_BLUEPRINT_V1.md`.
- Source content/credits: `SHOWTIME_EDITORIAL_MASTER_V1.md`.
- Motion and accessibility: [W3C WCAG 2.2 animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions).

**No graphics, UI or HTML generated in this task.**
