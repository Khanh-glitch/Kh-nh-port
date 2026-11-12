# Dossier interaction evidence — SwiftShader

- harness finished: 2026-11-12T12:48:52.331Z
- passed: no
- DOM viewports: desktop
- 3D world viewports: desktop
- planned suites: dom@desktop, world@desktop
- world entries (real visitor input): 0
- walk skipped: []
- dossier audits: 0/12
- independent input paths (E / ESC / scrim / reopen): 0
- failures: 19
  - [REAL_DEFECT][panel:about] desktop: TimeoutError: locator.evaluate: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="about"]').locator('[role="tab"]').nth(1)
    - locator resolved to visible <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>

  - [REAL_DEFECT][panel:orb] desktop: Error: Second project did not activate within 15s: orb selected=01ORBITA
  - [REAL_DEFECT][panel:piano] desktop: Error: Second project did not activate within 15s: piano selected=01AI Music Production
  - [REAL_DEFECT][panel:rubik] desktop: Error: Second project did not activate within 15s: rubik selected=01UEH · Quản trị dịch vụ sự kiện và giải trí
  - [REAL_DEFECT][panel:robot] desktop: Error: Second project did not activate within 15s: robot selected=01APEX CHAOS
  - [REAL_DEFECT][suite-timeout] desktop: exceeded 300000ms
  - [REAL_DEFECT][panel:apex] desktop: Error: Second project did not activate within 15s: apex selected=01APEX CHAOS · Source
  - [REAL_DEFECT][panel:ragnarok] desktop: Error: Second project did not activate within 15s: ragnarok selected=01Soul-of-Hero
  - [REAL_DEFECT][panel:cinema] desktop: Error: Second project did not activate within 15s: cinema selected=01Quê Quá Quao
  - [REAL_DEFECT][panel:stage] desktop: TimeoutError: locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="stage"]') to be detached
    13 × locator resolved to visible <div data-project-dossier="stage" class="absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-2 py-2 text-white sm:px-6 sm:py-6">…</div>

  - [REAL_DEFECT][suite-timeout] desktop: exceeded 300000ms
  - [REAL_DEFECT][world-entry:products] desktop: Error: mouse.move: Target page, context or browser has been closed
  - [REAL_DEFECT][world-entry:rubik] desktop: Error: page.goto: Target page, context or browser has been closed
  - [REAL_DEFECT][world-entry:beacon] desktop: Error: page.goto: Target page, context or browser has been closed
  - [REAL_DEFECT][world-entry:piano] desktop: Error: page.goto: Target page, context or browser has been closed
  - [REAL_DEFECT][world-entry:cinema] desktop: Error: page.goto: Target page, context or browser has been closed
  - [REAL_DEFECT][world-entry:orb] desktop: Error: page.goto: Target page, context or browser has been closed
  - [REAL_DEFECT][world-entry:robot] desktop: Error: page.goto: Target page, context or browser has been closed
  - [REAL_DEFECT][key-entry:stage] desktop: Error: page.goto: Target page, context or browser has been closed
- reached stage: {"at":"standAt:navigate","suite":"desktop","step":null}
- total ms: 600004

## Verdict

FAIL — 19 real defect(s), 0 unproven within the time budget.
Nothing here is reported as passing without a real input and a real result.
