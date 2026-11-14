import * as THREE from 'three'
import { SECTIONS } from './data/blueprint'
import { createBuildContext } from './cockpit/datum'
import { buildMaterials } from './cockpit/materials'
import { buildHullAndCanopy } from './cockpit/assemblies/hullAndCanopy'
import { buildDashAndHud } from './cockpit/assemblies/dashAndHud'
import { buildPedestalAndControls } from './cockpit/assemblies/pedestalAndControls'
import { buildSeatAndBulkhead } from './cockpit/assemblies/seatAndBulkhead'

/**
 * Preparation-only adapter. Original assemblies/materials stay intact; no
 * source-project sky, application UI, dossier or postprocessing is imported.
 * Yielding between assemblies does not guarantee a smooth frame: individual
 * builders and their first GPU draws still require profiling before use.
 */
export function createStagedCockpit() {
  const group = new THREE.Group()
  group.name = 'HX-9 cockpit'
  const materials = buildMaterials()
  const context = createBuildContext(group, materials)
  let stage = 0
  const steps = [
    () => buildHullAndCanopy(context),
    () => { const dash = buildDashAndHud(context); dash.updateScreen(SECTIONS[0], 0.62) },
    () => { const controls = buildPedestalAndControls(context); controls.setThrottle(0.62) },
    () => buildSeatAndBulkhead(context),
  ]
  return {
    group,
    get completed() { return stage },
    get total() { return steps.length },
    buildNext() {
      if (stage >= steps.length) return false
      steps[stage]()
      stage++
      return true
    },
    dispose() {
      context.disposables.forEach(d => d.dispose())
      materials.disposables.forEach(d => d.dispose())
      group.clear()
    },
  }
}
