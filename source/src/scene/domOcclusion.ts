import * as THREE from 'three'

/** DOM video cannot depth-test against WebGL. Sample the real opaque scene on
 * a small grid and mask only the covered screen cells. One ray per update keeps
 * this bounded; screen geometry itself is ignored within the depth tolerance.
 * Native Three.js surfaces (e.g. the VNG photo) use the real depth buffer. */
export class DomOcclusion {
  private ray = new THREE.Raycaster()
  private point = new THREE.Vector3()
  private direction = new THREE.Vector3()
  private candidates: THREE.Object3D[] = []
  private lastCollect = -Infinity
  private lastRay = -Infinity
  private cell = 0
  private visible = Array<boolean>(24).fill(true)

  update(layer: HTMLElement, camera: THREE.Camera, scene: THREE.Scene, corners: THREE.Vector3[], now: number) {
    if (now - this.lastRay < 0.035) return
    this.lastRay = now
    if (now - this.lastCollect > 1.5) {
      this.candidates.length = 0
      scene.traverseVisible(object => {
        const mesh = object as THREE.Mesh
        if (!mesh.isMesh || !mesh.material || !mesh.geometry) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        if (!materials.some(m => m.visible && m.depthWrite && (!m.transparent || m.opacity >= 0.98))) return
        this.candidates.push(mesh)
      })
      this.lastCollect = now
    }
    const col = this.cell % 6, row = Math.floor(this.cell / 6)
    const u = (col + 0.5) / 6, v = (row + 0.5) / 4
    this.point.copy(corners[0]).lerp(corners[1], u)
    this.direction.copy(corners[2]).lerp(corners[3], u)
    this.point.lerp(this.direction, v)
    this.direction.subVectors(this.point, camera.position)
    const distance = this.direction.length()
    this.ray.set(camera.position, this.direction.normalize())
    this.ray.far = Math.max(0, distance - 0.22)
    this.visible[this.cell] = this.ray.intersectObjects(this.candidates, false).length === 0
    this.cell = (this.cell + 1) % this.visible.length
    if (this.cell !== 0) return
    if (this.visible.every(Boolean)) { layer.style.maskImage = ''; return }
    // SVG mask uses local element coordinates, so CSS homography transforms it
    // with the video. Per-cell coverage is approximate, not pixel depth.
    const rects = this.visible.map((show, i) => show
      ? `<rect x="${i % 6}" y="${Math.floor(i / 6)}" width="1" height="1" fill="white"/>` : '').join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 4" preserveAspectRatio="none">${rects}</svg>`
    layer.style.maskImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    layer.style.maskSize = '100% 100%'
  }
}
