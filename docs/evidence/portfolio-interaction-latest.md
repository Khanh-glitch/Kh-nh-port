# Dossier interaction evidence — SwiftShader

- harness finished: 2026-11-12T13:05:19.575Z
- passed: no
- DOM viewports: desktop
- 3D world viewports: desktop
- planned suites: dom@desktop, world@desktop
- world entries (real visitor input): 0
- walk skipped: []
- dossier audits: 2/12
- independent input paths (E / ESC / scrim / reopen): 1
- failures: 20
  - [REAL_DEFECT][panel:piano] desktop: Error: Second project did not activate within 15s: piano selected=01AI Music Production
  - [REAL_DEFECT][panel:rubik] desktop: Error: Second project did not activate within 15s: rubik selected=01UEH · Quản trị dịch vụ sự kiện và giải trí
  - [REAL_DEFECT][panel:robot] desktop: Error: Second project did not activate within 15s: robot selected=01APEX CHAOS
  - [REAL_DEFECT][panel:apex] desktop: Error: Second project did not activate within 15s: apex selected=01APEX CHAOS · Source
  - [REAL_DEFECT][panel:ragnarok] desktop: Error: Second project did not activate within 15s: ragnarok selected=01Soul-of-Hero
  - [REAL_DEFECT][panel:cinema] desktop: Error: Second project did not activate within 15s: cinema selected=01Quê Quá Quao
  - [UNPROVEN_TIME_BUDGET][panel:stage] desktop: TimeoutError: locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="stage"]') to be detached
    27 × locator resolved to visible <div data-project-dossier="stage" class="absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-2 py-2 text-white sm:px-6 sm:py-6">…</div>

  - [REAL_DEFECT][panel:products] desktop: Error: Second project did not activate within 15s: products selected=01EventFlow Pro
  - [REAL_DEFECT][panel:beacon] desktop: Error: Second project did not activate within 15s: beacon selected=01Email · LÊ QUỐC KHÁNH
  - [UNPROVEN_TIME_BUDGET][panel:vng] desktop: TimeoutError: locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="vng"]') to be detached
    27 × locator resolved to visible <div data-project-dossier="vng" class="absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-2 py-2 text-white sm:px-6 sm:py-6">…</div>

  - [REAL_DEFECT][suite-timeout] desktop: exceeded 420000ms
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
- total ms: 820034

## Verdict

FAIL — 10 real defect(s), 10 unproven within the time budget.
Nothing here is reported as passing without a real input and a real result.
