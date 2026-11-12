# Dossier interaction evidence — SwiftShader

- harness finished: 2026-11-12T16:18:59.725Z
- passed: no
- DOM viewports: desktop
- 3D world viewports: desktop
- planned suites: dom@desktop, world@desktop
- world entries (real visitor input): 0
- walk skipped: []
- dossier audits: 0/12
- independent input paths (E / ESC / scrim / reopen): 0
- failures: 23
  - [UNPROVEN_TIME_BUDGET][panel:about] desktop: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="about"]').getByRole('button', { name: 'Đóng hồ sơ dự án' })
    - locator resolved to <button type="button" aria-label="Đóng hồ sơ dự án" class="shrink-0 rounded-full border border-white/20 px-4 py-2 text-[11px] tracking-[0.2em] transition-colors hover:border-white/60 hover:bg-white/10">ESC ✕</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed

  - [REAL_DEFECT][panel:orb] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [REAL_DEFECT][panel:piano] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [REAL_DEFECT][panel:rubik] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [REAL_DEFECT][panel:robot] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [REAL_DEFECT][panel:apex] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [REAL_DEFECT][panel:ragnarok] desktop: Error: a covering element blocks the tab on ragnarok | cover=none
  - [REAL_DEFECT][panel:cinema] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [REAL_DEFECT][suite-timeout] desktop: exceeded 420000ms
  - [REAL_DEFECT][panel:stage] desktop: Error: a covering element blocks the tab on stage | cover=none
  - [REAL_DEFECT][panel:products] desktop: Error: a covering element blocks the tab on products | cover=none
  - [REAL_DEFECT][panel:beacon] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [REAL_DEFECT][panel:vng] desktop: Error: a covering element blocks the tab on vng | cover=none
  - [REAL_DEFECT][input-paths] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [REAL_DEFECT][suite-timeout] desktop: exceeded 420000ms
  - [UNPROVEN_TIME_BUDGET][world-entry:products] desktop: Error: mouse.move: Target page, context or browser has been closed
  - [UNPROVEN_TIME_BUDGET][world-entry:rubik] desktop: Error: page.goto: Target page, context or browser has been closed
  - [UNPROVEN_TIME_BUDGET][world-entry:beacon] desktop: Error: page.goto: Target page, context or browser has been closed
  - [UNPROVEN_TIME_BUDGET][world-entry:piano] desktop: Error: page.goto: Target page, context or browser has been closed
  - [UNPROVEN_TIME_BUDGET][world-entry:cinema] desktop: Error: page.goto: Target page, context or browser has been closed
  - [UNPROVEN_TIME_BUDGET][world-entry:orb] desktop: Error: page.goto: Target page, context or browser has been closed
  - [UNPROVEN_TIME_BUDGET][world-entry:robot] desktop: Error: page.goto: Target page, context or browser has been closed
  - [UNPROVEN_TIME_BUDGET][key-entry:stage] desktop: Error: page.goto: Target page, context or browser has been closed
- reached stage: {"at":"standAt:navigate","suite":"desktop","step":null}
- total ms: 840003

## Verdict

FAIL — 14 real defect(s), 9 unproven within the time budget.
Nothing here is reported as passing without a real input and a real result.
