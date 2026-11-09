import { Experience } from './scene/Experience'
import { Overlay } from './ui/Overlay'
import { RealityHud } from './ui/RealityHud'

export default function App() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-black font-sans">
      <Experience />
      <Overlay />
      <RealityHud />
    </div>
  )
}
