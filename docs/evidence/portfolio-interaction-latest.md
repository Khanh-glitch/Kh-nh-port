# Dossier interaction evidence — SwiftShader

- harness finished: 2026-11-12T14:04:35.392Z
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
  - waiting for locator('[data-project-dossier="about"]').locator('[role="tab"]').nth(1)
    - locator resolved to <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable

  - [UNPROVEN_TIME_BUDGET][panel:orb] desktop: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="orb"]').locator('[role="tab"]').nth(1)
    - locator resolved to <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action
    - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable

  - [REAL_DEFECT][panel:piano] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [UNPROVEN_TIME_BUDGET][panel:rubik] desktop: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="rubik"]').locator('[role="tab"]').nth(1)
    - locator resolved to <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    - waiting for element to be visible, enabled and stable

  - [REAL_DEFECT][panel:robot] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [UNPROVEN_TIME_BUDGET][panel:apex] desktop: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="apex"]').locator('[role="tab"]').nth(1)
    - locator resolved to <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    31 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - performing click action
       - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
     - retrying click action
       - waiting 500ms

  - [UNPROVEN_TIME_BUDGET][panel:ragnarok] desktop: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="ragnarok"]').locator('[role="tab"]').nth(1)
    - locator resolved to <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    33 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - performing click action
       - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
     - retrying click action
       - waiting 500ms

  - [REAL_DEFECT][panel:cinema] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [UNPROVEN_TIME_BUDGET][panel:stage] desktop: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="stage"]').locator('[role="tab"]').nth(1)
    - locator resolved to <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    29 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - performing click action
       - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
     - retrying click action
       - waiting 500ms

  - [UNPROVEN_TIME_BUDGET][panel:products] desktop: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="products"]').locator('[role="tab"]').nth(1)
    - locator resolved to <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    23 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - performing click action
       - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
     - retrying click action
       - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action

  - [UNPROVEN_TIME_BUDGET][panel:beacon] desktop: TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="beacon"]').locator('[role="tab"]').nth(1)
    - locator resolved to <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    27 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - performing click action
       - <div aria-hidden="true" class="absolute inset-0"></div> intercepts pointer events
     - retrying click action
       - waiting 500ms

  - [REAL_DEFECT][panel:vng] desktop: Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  - [REAL_DEFECT][input-paths] desktop: Error: Public ORBITA evidence CTA missing after tab selection
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
- total ms: 773650

## Verdict

FAIL — 7 real defect(s), 16 unproven within the time budget.
Nothing here is reported as passing without a real input and a real result.
