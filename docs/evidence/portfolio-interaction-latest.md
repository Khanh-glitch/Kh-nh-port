# Dossier interaction evidence — SwiftShader

- harness finished: 2026-11-12T13:46:46.343Z
- passed: no
- DOM viewports: desktop
- 3D world viewports: desktop
- planned suites: dom@desktop, world@desktop
- world entries (real visitor input): 0
- walk skipped: []
- dossier audits: 0/12
- independent input paths (E / ESC / scrim / reopen): 0
- failures: 14
  - [UNPROVEN_TIME_BUDGET][panel:about] desktop: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="about"]').locator('[role="tab"]').nth(1)
    - locator resolved to <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed

  - [UNPROVEN_TIME_BUDGET][panel:orb] desktop: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="orb"]').locator('[role="tab"]').nth(1)
    - locator resolved to <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

  - [REAL_DEFECT][suite-timeout] desktop: exceeded 420000ms
  - [UNPROVEN_TIME_BUDGET][panel:piano] desktop: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="piano"]').locator('[role="tab"]').nth(1)
    - locator resolved to <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable

  - [UNPROVEN_TIME_BUDGET][panel:rubik] desktop: TimeoutError: locator.waitFor: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="rubik"]') to be visible

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

FAIL — 2 real defect(s), 12 unproven within the time budget.
Nothing here is reported as passing without a real input and a real result.
