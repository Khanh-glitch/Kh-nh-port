import { Piano } from './Piano'
import { Rubik } from './Rubik'
import { Orb } from './Orb'
import { Robot } from './Robot'
import { Cinema } from './Cinema'
import { Stage } from './Stage'
import { Products } from './Products'
import { Beacon } from './Beacon'
import { VngGallery } from './VngGallery'

// PERFORMANCE ISOLATION ONLY: compare idle frames without other exhibits.
// Never merge this branch: production must retain every exhibit.
export function Exhibits() {
  return <group><Robot /></group>
}
