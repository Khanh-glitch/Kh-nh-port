import { Piano } from './Piano'
import { Rubik } from './Rubik'
import { Orb } from './Orb'
import { Robot } from './Robot'
import { Cinema } from './Cinema'
import { Stage } from './Stage'
import { Products } from './Products'
import { Beacon } from './Beacon'
import { VngGallery } from './VngGallery'

export function Exhibits() {
  return (
    <group>
      <Orb />
      <Piano />
      <Rubik />
      <Robot />
      <VngGallery />
      <Cinema />
      <Stage />
      <Products />
      <Beacon />
    </group>
  )
}
