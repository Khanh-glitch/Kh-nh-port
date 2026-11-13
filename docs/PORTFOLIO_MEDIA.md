# Portfolio media integration

The current branch incorporates the relevant work from `7bf01fa` into the newer
space-first entry instead of replacing the entry with that commit's older tree.
After edits, run `node scripts/sync-portfolio-standalone.mjs` followed by
`node scripts/build-pages.mjs`; Cloudflare serves the root standalone map.

## Sources and limits

* The VNGenius Prompt To Play folder URL was supplied by the owner. The photo
  comes from `01_ai_prompt_to_play.jpg` already present in the repository. The
  VNG logo and photograph open the supplied folder; that folder's sharing
  permissions were not changed.
* Three additional Cinema items were found in the owner's `Portfolio/SOCIAL MEDIA`
  folder and have public-link read permissions. Their Drive filenames do not
  establish the projects' names or credits, so the UI uses neutral labels. The
  embedded preview may need a click to play; the exterior link opens Drive.
* Three short videos from `Portfolio/A.I` are available as same-origin Cinema
  clips: `the_foot_betrays_you.mp4` (14s),
  `unheard-music-discovery-1920x1080-30fps.mp4` (8s), and `Video Project 3.mp4`
  (10s) from the CoravaMaris game folder linked from Prompt to Play. The latter
  was transcoded to 720p H.264/AAC to reduce its size; the originals remain on
  Drive and the exterior link points to the selected original. Their inclusion
  establishes their location in the portfolio, not individual authorship. The
  first clip is also a muted exterior poster teaser, paused when distant or
  during HEX; its playback still depends on browser autoplay policy.
* Mùa Hạ audio was downloaded through the connected Drive from the owner's
  `Untitled_8_May_2024_2243.wav` (50,203,630 bytes; 284.60 seconds). The full
  timeline was transcoded with FFmpeg `libmp3lame -q:a 2` into
  `source/public/reality/mua-ha-thu-18.mp3` (SHA-256
  `a017fba112566609d36145ea95eaa77f6f0fb846ff8f962597dc447b4432458e`).
  Playback seeks to 114 seconds and ends with the file; it is served from the
  same origin instead of the Drive viewer. The original Drive link is retained.
  A browser can still block autoplay; the labelled demo is the fallback.
  No sharing permissions were modified.
* The official YouTube player for Nếu Ngày Mai starts at 82 seconds and owns
  its audio; autoplay and embedding are subject to browser/YouTube policy. The
  Drive video uses its official preview and may need a user click. Both HEX
  players are removed on retract. The original island stage player is torn
  down while HEX is open and recreated afterwards.
* GitHub is the only profile URL established by the repository. The other
  social icons currently use the supplied folder as a clearly marked fallback,
  not invented account handles.

`tests/portfolio-media-contract.mjs` and `tests/beacon-media-panel.mjs` check
source and standalone wiring, not remote playback. Browser playback, Drive
access for anonymous visitors, placement, and GPU performance still need a
manual check in the deployed environment.

QA note: headless Chromium loaded and played the MP3 from 114 seconds and all
three local MP4 files using a server with HTTP range support (206). The actual
browser playback policy and sound output on the visitor's device can differ.
The sandbox cannot reach the external ESM CDNs, Google Drive, or YouTube; the
standalone entry and remote embeds therefore cannot be fully verified there.
A bundled source build reached the island fallback under software rendering,
but the HEX transition did not complete in the test window, so its visual
placement and interaction, and Beacon/Cinema interaction, remain manual QA.
Production hosting must support byte range requests for reliable media seeking.

Offline-CDN QA: after `node scripts/build-pages.mjs`, run
`node scripts/prepare-offline-browser-qa.mjs` to replace CDN module imports
in the *temporary build output only* with shared bundles from the installed
packages. Serve `dist-pages` with byte-range support. In headless Chromium,
this allowed the real standalone app and WebGL to boot despite the sandbox's
CDN restriction. The actual `music.start('mua-ha')` loaded and played the
local recording (not demo). Forced HEX states mounted the Drive preview and
removed it on track switch; a stub YouTube API received video `179btG24VE8`,
start 82, play, and destroy on exit. The stub verifies player lifecycle only,
not YouTube network playback. HEX phase changes were forced for this test;
the full transition, placement, Beacon and Cinema interactions remain to be
verified on a real GPU. Rebuild with `node scripts/build-pages.mjs` before
deployment: the offline QA patch is intentionally not a production artifact.

Playback update: Cinema now automatically loops through the three local clips
while nearby, advances on end, and lets visitors click the screen to skip.
The local clips are muted so browsers permit autoplay; the three large Drive
previews are no longer part of this automatic playlist. The VNG photograph is
mounted on slide zero of the projector screen and hidden on the other slides.
For HEX, the YouTube API is primed before selection, its player starts during
ignition at 82 seconds, and a play/unmute control is shown if autoplay is
blocked. A failed API load can be retried. The Drive preview now requests
`autoplay=1&mute=1`, but Google Drive does not document a reliable autoplay or
mute API for this preview; it may still require clicking the player, and its
audio cannot be reliably controlled from this site. The original 124.8 MB
video exceeds the Drive connector's 100 MiB download limit, so it has not
been converted to a local playable video. The before-click scene snapshot
reduces repeated trigger work but first-use GPU hitch and remote Google
playback still require checking in a real browser with an actual GPU/network.

Latest playback/interaction update (supersedes previous Cinema/Beacon notes):
Cinema includes all three original SOCIAL MEDIA Drive previews alongside the
three local clips; local clips attempt sound unless the global mute is active,
and expose controls if autoplay is blocked. Drive embeds remain subject to
Google and browser playback policies; end-of-video cannot be observed by the
parent, so use the next-film button to advance from a Drive preview. The owner
provided the Facebook, Instagram, TikTok, LinkedIn and GitHub URLs; Discord
alone remains unconfirmed. The Mùa Hạ recording is still a separate same-origin
MP3 that seeks to 114s; the unrelated video is a Drive iframe. Drive does not
provide a controllable mute API for that preview, so `mute=1` is only a request,
not a guarantee that its own soundtrack cannot overlap the MP3.

The visible scene now offers LOW / PERFORMANCE / gated HIGH (Q and H, or the
buttons), and forward motion follows the view pitch; Space/Ctrl adjust altitude.
PERFORMANCE restores the measured six-rung auto-ladder from baseline 7bf01fa: it starts at LOW and adjusts film passes, resolution, shadow size and bloom only as needed; particles use LOW counts.
Before HEX sweep, ignition waits for critical prewarm resources for up to eight
seconds; this can reduce cold GPU work but does not prove no stalls on every
GPU. HTML video layers use a throttled coarse 6×4 scene raycast mask: real
opaque obstacles hide approximate portions of the video, not a pixel-perfect
WebGL depth buffer. The VNG photo is an ordinary depth-tested Three.js mesh.

Latest Cinema/HEX changes: same-origin films now play on a native Three.js
VideoTexture plane with ordinary pixel-level depth testing. Their audio is
routed once through the existing HRTF cinema-film bus (distance rolloff and
reverb, master mute). The room light dims and the entrance doors close while a
film is selected, reopening when the player approaches from either side. The
film label explicitly says the individual credit is not verified: a search of
the owner's GitHub repositories found no per-film role for these six titles.
Drive previews still cannot be sampled into WebGL or routed to WebAudio due to
cross-origin restrictions, so the three Drive films retain DOM projection,
coarse masking, browser playback controls and non-spatial sound.

Mùa Hạ's Drive preview iframe was removed to prevent its uncontrollable audio
from overlapping the separately supplied recording. The video is now a muted
HTML media element; direct Google Drive download can return a confirmation
page or be blocked, in which case an explicit original-video link appears
instead. This guarantees the embedded video's sound is muted but does not
prove the Drive video will actually decode in every visitor's browser.

The distant Cinema canvas readback gate now runs by default during HEX; older
native traces identify that readback as an independent main-thread bottleneck.
The remaining cold GPU UEH draw is not yet proven hitch-free; real GPU frame
pacing and partial occlusion of cross-origin embeds still need verification.
