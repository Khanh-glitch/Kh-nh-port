import { useEffect, useState } from 'react'
import { Piano } from './Piano'
import { Rubik } from './Rubik'
import { Orb } from './Orb'
import { Robot } from './Robot'
import { Cinema } from './Cinema'
import { Stage } from './Stage'
import { Products } from './Products'
import { Beacon } from './Beacon'
import { VngGallery } from './VngGallery'
import { Station } from './Station'

export function Exhibits({ staged = false, onReady }: { staged?: boolean; onReady?: () => void }) {
  const [count, setCount] = useState(staged ? 0 : 10)
  useEffect(() => {
    if (!staged || count >= 10) { onReady?.(); return }
    let timer = 0
    const frame = requestAnimationFrame(() => {
      // Let the cockpit paint before the next real exhibit is built.
      timer = window.setTimeout(() => setCount(n => n + 1), 0)
    })
    return () => { cancelAnimationFrame(frame); clearTimeout(timer) }
  }, [count, staged, onReady])
  return (
    <group>
      {count >= 1 && <Station />}
      {count >= 2 && <Orb />}
      {count >= 3 && <Piano />}
      {count >= 4 && <Rubik />}
      {count >= 5 && <Robot />}
      {count >= 6 && <VngGallery />}
      {count >= 7 && <Cinema />}
      {count >= 8 && <Stage />}
      {count >= 9 && <Products />}
      {count >= 10 && <Beacon />}
    </group>
  )
}
