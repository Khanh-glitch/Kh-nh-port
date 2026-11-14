import * as THREE from 'three';
import { SECTIONS, type CockpitSection } from '../data/blueprint';
import type { MaterialLibrary } from './materials';
import { createBuildContext, DATUM } from './datum';
import { buildHullAndCanopy } from './assemblies/hullAndCanopy';
import { buildDashAndHud } from './assemblies/dashAndHud';
import { buildPedestalAndControls } from './assemblies/pedestalAndControls';
import { buildSeatAndBulkhead } from './assemblies/seatAndBulkhead';

export interface CockpitModel {
  group: THREE.Group;
  updateScreen: (section: CockpitSection, throttle: number) => void;
  setThrottle: (value: number) => void;
  ledMaterials: THREE.MeshStandardMaterial[];
  screenMeshes: THREE.Mesh[];
  decals: THREE.Object3D[];
  markers: THREE.Object3D[];
  dispose: () => void;
}

export function buildCockpit(mats: MaterialLibrary): CockpitModel {
  const group = new THREE.Group();
  group.name = 'HX-9 cockpit';

  const ctx = createBuildContext(group, mats);
  const markers: THREE.Object3D[] = [];

  // 1. Pressure shell, footwells, ring formers, canopy spaceframe, glazing, latches & overhead bridge
  buildHullAndCanopy(ctx);

  // 2. 3-segment wrap-around MIP, hollow CNC bezels, optical glareshield, GCP, collimated HUD & avionics rack
  const dash = buildDashAndHud(ctx);

  // 3. Tapered center pedestal, FMS/CDU, slotted dual-throttle, trim wheel, RHC, THC & rudder/brake pedals
  const controls = buildPedestalAndControls(ctx);

  // 4. 9-station CFRP monocoque seat, shock struts, 5-point cam-lock harness, O2 umbilical & aft pressure hatch
  buildSeatAndBulkhead(ctx);

  // Seed initial screen & throttle state
  dash.updateScreen(SECTIONS[0], 0.62);
  controls.setThrottle(0.62);

  return {
    group,
    updateScreen: dash.updateScreen,
    setThrottle: controls.setThrottle,
    ledMaterials: ctx.ledMaterials,
    screenMeshes: ctx.screenMeshes,
    decals: ctx.decals,
    markers,
    dispose: () => ctx.disposables.forEach((d) => d.dispose()),
  };
}

export const COCKPIT_DECK_Y = DATUM.deckY;
export const COCKPIT_EYE_Y = DATUM.eyeY;
