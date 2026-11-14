// Proof-of-concept only; not wired to the live opening.
// Procedural geometry and the original canvas textures are built off-thread.
import { createStagedCockpit } from './stagedCockpit'
const scope = self as unknown as {
  document?: unknown
  onmessage: ((event: MessageEvent) => void) | null
  postMessage: (message: unknown) => void
}
scope.document = { createElement(name: string) {
  if (name !== 'canvas') throw new Error(`Unsupported worker element: ${name}`)
  return new OffscreenCanvas(1, 1)
} }
scope.onmessage = ({ data }) => {
  if (data !== 'measure') return
  try {
    const times: number[] = []
    let t = performance.now()
    const cockpit = createStagedCockpit()
    times.push(performance.now() - t)
    for (let i=0;i<4;i++) { t=performance.now();cockpit.buildNext();times.push(performance.now()-t) }
    let meshes=0
    cockpit.group.traverse(o => { if ((o as {isMesh?:boolean}).isMesh) meshes++ })
    scope.postMessage({ ok:true, times, meshes })
    cockpit.dispose()
  } catch (error) { scope.postMessage({ok:false,error:String(error)}) }
}
