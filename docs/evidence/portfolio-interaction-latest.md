# Dossier interaction evidence — SwiftShader

- harness finished: 2026-11-12T12:30:49.612Z
- passed: no
- DOM viewports: desktop
- 3D world viewports: desktop
- planned suites: dom@desktop, world@desktop
- world entries (real visitor input): 0
- walk skipped: []
- dossier audits: 1/12
- independent input paths (E / ESC / scrim / reopen): 0
- failures: 27
  - [REAL_DEFECT][panel:orb] desktop: Error: Second project did not activate: orb selected=01ORBITA
  - [REAL_DEFECT][panel:piano] desktop: Error: Second project did not activate: piano selected=01AI Music Production
  - [REAL_DEFECT][panel:rubik] desktop: Error: Second project did not activate: rubik selected=01UEH · Quản trị dịch vụ sự kiện và giải trí
  - [REAL_DEFECT][panel:robot] desktop: Error: Second project did not activate: robot selected=01APEX CHAOS
  - [REAL_DEFECT][panel:apex] desktop: Error: Second project did not activate: apex selected=01APEX CHAOS · Source
  - [REAL_DEFECT][panel:ragnarok] desktop: Error: Second project did not activate: ragnarok selected=01Soul-of-Hero
  - [REAL_DEFECT][panel:cinema] desktop: Error: Second project did not activate: cinema selected=01Quê Quá Quao
  - [REAL_DEFECT][panel:stage] desktop: TimeoutError: locator.waitFor: Timeout 12000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="stage"]') to be detached
    10 × locator resolved to visible <div data-project-dossier="stage" class="absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-2 py-2 text-white sm:px-6 sm:py-6">…</div>

  - [REAL_DEFECT][panel:products] desktop: Error: Second project did not activate: products selected=01EventFlow Pro
  - [REAL_DEFECT][panel:beacon] desktop: Error: Second project did not activate: beacon selected=01Email · LÊ QUỐC KHÁNH
  - [REAL_DEFECT][suite-timeout] desktop: exceeded 300000ms
  - [REAL_DEFECT][world-entry:products] desktop: TypeError: Cannot read properties of null (reading 'me')
  - [REAL_DEFECT][world-entry:rubik] desktop: Error: Deep-linked viewpoint placed the visitor 39.6m from the requested walkable pose
  - [REAL_DEFECT][panel:vng] desktop: TimeoutError: locator.evaluate: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-project-dossier="vng"]').locator('[role="tab"]').nth(1)
    - locator resolved to visible <button role="tab" type="button" aria-selected="false" class="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors">…</button>

  - [REAL_DEFECT][world-entry:beacon] desktop: Error: Deep-linked viewpoint placed the visitor 53.3m from the requested walkable pose
  - [REAL_DEFECT][world-entry:piano] desktop: Error: Deep-linked viewpoint placed the visitor 53.0m from the requested walkable pose
  - [REAL_DEFECT][world-entry:cinema] desktop: Error: Deep-linked viewpoint placed the visitor 32.4m from the requested walkable pose
  - [REAL_DEFECT][world-entry:orb] desktop: Error: Deep-linked viewpoint placed the visitor 27.9m from the requested walkable pose
  - [REAL_DEFECT][world-entry:robot] desktop: Error: Deep-linked viewpoint placed the visitor 52.5m from the requested walkable pose
  - [REAL_DEFECT][key-entry:stage] desktop: Error: Deep-linked viewpoint placed the visitor 65.8m from the requested walkable pose
  - [REAL_DEFECT][key-entry:vng] desktop: Error: Deep-linked viewpoint placed the visitor 50.5m from the requested walkable pose
  - [REAL_DEFECT][panel:about] desktop: Error: Second project did not activate: about selected=01ORBITA · 3D Portfolio
  - [REAL_DEFECT][input-paths] desktop: Error: Public ORBITA evidence CTA missing after tab selection
  - [REAL_DEFECT][panel:orb] desktop: Error: Second project did not activate: orb selected=01ORBITA
  - [REAL_DEFECT][panel:piano] desktop: Error: Second project did not activate: piano selected=01AI Music Production
  - [REAL_DEFECT][panel:rubik] desktop: Error: Second project did not activate: rubik selected=01UEH · Quản trị dịch vụ sự kiện và giải trí
  - [REAL_DEFECT][suite-timeout] desktop: exceeded 300000ms
- reached stage: {"at":"auditPanel:rubik","suite":"desktop","step":null}
- total ms: 600002

## Verdict

FAIL — 27 real defect(s), 0 unproven within the time budget.
Nothing here is reported as passing without a real input and a real result.
