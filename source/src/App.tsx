import { useCallback, useState } from 'react'
import { Experience } from './scene/Experience'
import { Overlay } from './ui/Overlay'
import { RealityHud } from './ui/RealityHud'

/**
 * First paint is ALWAYS the real spaceship, never the island.
 * Mounting the hidden island Canvas before the spacecraft has painted gave
 * browsers a chance to flash the full map and competed for WebGL resources.
 * A real frame acknowledgement from SpaceScene permits island loading;
 * failure explicitly mounts the island behind a recoverable error surface.
 */
export default function App() {
  const [spacePresented, setSpacePresented] = useState(false)
  const acceptSpace = useCallback(() => setSpacePresented(true), [])
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#02040a] font-sans">
      <Overlay onSpacePresented={acceptSpace} onSpaceUnavailable={acceptSpace} />
      {spacePresented && <Experience />}
      {spacePresented && <RealityHud />}
    </div>
  )
}
