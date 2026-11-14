import * as THREE from 'three'
import { SECTIONS } from './data/blueprint'
import { createBuildContext } from './cockpit/datum'
import { buildMaterials } from './cockpit/materials'
import { buildHullAndCanopy } from './cockpit/assemblies/hullAndCanopy'
import { buildDashAndHud } from './cockpit/assemblies/dashAndHud'
import { buildPedestalAndControls } from './cockpit/assemblies/pedestalAndControls'
import { buildSeatAndBulkhead } from './cockpit/assemblies/seatAndBulkhead'

/**
 * Original assemblies/materials stay intact; no source-project sky or UI.
 * The caller yields between assemblies and announces each step. Individual
 * assembly construction and first GPU upload may still cause a visible pause.
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
    materials,
    screens: context.screenMeshes,
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
