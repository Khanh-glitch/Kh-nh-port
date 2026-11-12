import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { passesInteractiveFilter, player, input, getTargets, getInteractive, canvasRef, resolveCollisions, type Interactive } from '../world'
import { DISC_R, EYE, EXHIBIT_LIST } from '../layout'
import { audio } from '../audio'
import type { PanelId } from '../content'

let lockedOnce = false

export function requestLock() {
  const el = canvasRef.el
  const s = useStore.getState()
  if (!el || s.touch) return
  try {
    const p = el.requestPointerLock() as unknown as Promise<void> | undefined
    p?.catch?.(() => {})
  } catch {
    /* ignore */
  }
}

function checkLockLater() {
  window.setTimeout(() => {
    const st = useStore.getState()
    if (st.phase !== 'playing' || st.panel) return
    if (!st.locked && !st.freeMouse) {
      if (lockedOnce) st.setPaused(true)
      else st.setFree(true)
    }
  }, 700)
}

export function startGame() {
  const s = useStore.getState()
  void audio.start()
  s.setPhase('playing')
  s.setPaused(false)
  requestLock()
  checkLockLater()
}

export function resumeGame() {
  const s = useStore.getState()
  if (s.touch || s.freeMouse) {
    s.setPaused(false)
    return
  }
  requestLock()
  checkLockLater()
}

export function openPanel(p: PanelId) {
  const s = useStore.getState()
  s.openPanel(p)
  audio.uiOpen()
  if (document.pointerLockElement) document.exitPointerLock()
}

export function closePanel(viaClick = true) {
  const s = useStore.getState()
  s.openPanel(null)
  audio.uiClick()
  if (s.touch || s.freeMouse) return
  if (viaClick) {
    requestLock()
    checkLockLater()
  } else s.setPaused(true)
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function Player() {
  const { camera, gl } = useThree()
  const keys = useRef<Record<string, boolean>>({}).current
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const pointer = useRef(new THREE.Vector2(0, 0)).current
  const hovered = useRef<{ it: Interactive; hit: THREE.Intersection } | null>(null)
  const hoverKey = useRef('')
  const vel = useRef(new THREE.Vector3()).current
  const yVel = useRef(0)
  const bob = useRef(0)
  const lastStep = useRef(0)
  const trans = useRef({ active: false, t: 0, fromP: new THREE.Vector3(), fromQ: new THREE.Quaternion(), lastPhase: 'intro' }).current
  const tmpQ = useMemo(() => new THREE.Quaternion(), [])
  const tmpE = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  const tmpV = useMemo(() => new THREE.Vector3(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(0, 8, 0), [])
  const center = useMemo(() => new THREE.Vector2(0, 0), [])

  const pick = (usePointer: boolean) => {
    if (usePointer) ray.setFromCamera(pointer, camera)
    else ray.setFromCamera(center, camera)
    ray.far = 70
    const hits = ray.intersectObjects(getTargets(), false)
    for (const h of hits) {
      if (!passesInteractiveFilter(h.object)) continue
      const it = getInteractive(h.object)
      if (it && h.distance <= it.maxDist) return { it, hit: h }
    }
    return null
  }

  const activate = (via: 'click' | 'key', found: { it: Interactive; hit: THREE.Intersection } | null) => {
    if (!found) return
    const { it, hit } = found
    if (via === 'click') {
      if (it.onClick) it.onClick(hit)
      else if (it.panel) openPanel(it.panel)
    } else {
      if (it.panel) openPanel(it.panel)
      else it.onClick?.(hit)
    }
  }

  useEffect(() => {
    const el = gl.domElement
    canvasRef.el = el
    const st = useStore
    // Debug / chia sẻ góc nhìn: #at=x,z,yawDeg,pitchDeg  #autostart  #skip
    const hash = window.location.hash
    const m = hash.match(/at=(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/)
    if (m) {
      player.pos.x = parseFloat(m[1])
      player.pos.z = parseFloat(m[2])
      player.yaw = (parseFloat(m[3]) * Math.PI) / 180
      player.pitch = (parseFloat(m[4]) * Math.PI) / 180
    }
    // Shareable viewpoint inside the walking world: #view=x,z,yawDeg,pitchDeg.
    // Unlike #at it is only a start pose on the walkable island; moving,
    // colliding and interacting then behave exactly like a normal visit, so a
    // shared link never bypasses the exhibits' own interaction rules.
    const view = hash.match(/view=(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/)
    if (view) {
      player.pos.x = parseFloat(view[1])
      player.pos.z = parseFloat(view[2])
      player.yaw = (parseFloat(view[3]) * Math.PI) / 180
      player.pitch = (parseFloat(view[4]) * Math.PI) / 180
    }
    if (hash.includes('skip')) trans.lastPhase = 'playing'
    if (hash.includes('autostart')) window.setTimeout(() => startGame(), 400)
    let dragging = false
    let moved = 0
    let lx = 0
    let ly = 0

    const look = (dx: number, dy: number, grab = false) => {
      const k = 0.0022 * (grab ? -1.15 : 1)
      player.yaw -= dx * k
      player.pitch = THREE.MathUtils.clamp(player.pitch - dy * k, -1.5, 1.5)
    }

    const onLockChange = () => {
      const locked = document.pointerLockElement === el
      const s = st.getState()
      s.setLocked(locked)
      if (locked) {
        lockedOnce = true
        s.setPaused(false)
      } else if (s.phase === 'playing' && !s.panel && !s.freeMouse && !s.touch) s.setPaused(true)
    }
    const onLockError = () => {
      const s = st.getState()
      if (!lockedOnce) {
        s.setFree(true)
        s.setPaused(false)
      } else s.setPaused(true)
    }
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === el) look(e.movementX, e.movementY)
    }
    const onPointerMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      if (dragging) {
        const dx = e.clientX - lx
        const dy = e.clientY - ly
        lx = e.clientX
        ly = e.clientY
        moved += Math.abs(dx) + Math.abs(dy)
        look(dx, dy, true)
      }
    }
    const onDown = (e: PointerEvent) => {
      const s = st.getState()
      if (s.phase !== 'playing' || s.panel || s.paused) return
      if (document.pointerLockElement === el) {
        activate('click', hovered.current)
        return
      }
      dragging = true
      moved = 0
      lx = e.clientX
      ly = e.clientY
      const r = el.getBoundingClientRect()
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const onUp = () => {
      if (dragging && moved < 8) activate('click', pick(true))
      dragging = false
    }
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      keys[e.code] = down
      const s = st.getState()
      if (down && s.phase === 'playing') {
        if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
        if (e.code === 'KeyI' && !s.panel) openPanel('about')
        if (e.code === 'KeyM') {
          s.setMuted(!s.muted)
          audio.setMuted(!s.muted)
        }
        if (e.code === 'KeyE' && !s.panel && !s.paused) {
          if (hovered.current) activate('key', hovered.current)
          else {
            let best: string | null = null
            let bd = 16
            for (const ex of EXHIBIT_LIST) {
              const d = Math.hypot(ex.x - player.pos.x, ex.z - player.pos.z)
              if (d < bd) {
                bd = d
                best = ex.id
              }
            }
            if (best) openPanel(best as PanelId)
          }
        } else if (e.code === 'Escape' && s.panel) closePanel(false)
      }
    }
    const kd = (e: KeyboardEvent) => onKey(e, true)
    const ku = (e: KeyboardEvent) => onKey(e, false)
    const blur = () => {
      for (const k of Object.keys(keys)) keys[k] = false
    }
    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('pointerlockerror', onLockError)
    document.addEventListener('mousemove', onMouseMove)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', blur)
    return () => {
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('pointerlockerror', onLockError)
      document.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('blur', blur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = useStore.getState()
    const t = state.clock.elapsedTime

    if (s.phase === 'intro') {
      const a = 0.6 + t * 0.045
      camera.position.set(Math.sin(a) * 88, 17 + Math.sin(t * 0.17) * 4, Math.cos(a) * 88)
      lookTarget.set(0, 6, 0)
      camera.lookAt(lookTarget)
      audio.update(camera)
      return
    }

    if (trans.lastPhase !== s.phase) {
      trans.lastPhase = s.phase
      trans.active = true
      trans.t = 0
      trans.fromP.copy(camera.position)
      trans.fromQ.copy(camera.quaternion)
    }

    // ---- input & chuyển động ----
    const canMove = !s.paused && !s.panel && !trans.active
    let fx = 0
    let fz = 0
    if (canMove) {
      fz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + input.moveY
      fx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + input.moveX
      if (keys.ArrowLeft) player.yaw += dt * 1.8
      if (keys.ArrowRight) player.yaw -= dt * 1.8
    }
    const len = Math.hypot(fx, fz)
    if (len > 1) {
      fx /= len
      fz /= len
    }
    const run = keys.ShiftLeft || keys.ShiftRight ? 1.9 : 1
    const speed = 7.2 * run
    const sin = Math.sin(player.yaw)
    const cos = Math.cos(player.yaw)
    // forward = (-sin, -cos), right = (cos, -sin)
    const wx = (-sin * fz + cos * fx) * speed
    const wz = (-cos * fz - sin * fx) * speed
    const k = 1 - Math.exp(-9 * dt)
    vel.x += (wx - vel.x) * k
    vel.z += (wz - vel.z) * k
    player.pos.x += vel.x * dt
    player.pos.z += vel.z * dt
    resolveCollisions(player.pos)
    const rr = Math.hypot(player.pos.x, player.pos.z)
    const maxR = DISC_R - 1.6
    if (rr > maxR) {
      player.pos.x *= maxR / rr
      player.pos.z *= maxR / rr
    }
    player.speed = Math.hypot(vel.x, vel.z)

    // nhảy (trọng lực thấp)
    if (canMove && keys.Space && player.grounded) {
      yVel.current = 6.4
      player.grounded = false
      audio.jump()
    }
    if (!player.grounded) {
      yVel.current -= 10.5 * dt
      player.pos.y += yVel.current * dt
      if (player.pos.y <= EYE) {
        player.pos.y = EYE
        player.grounded = true
        yVel.current = 0
        audio.land()
      }
    }

    // bob + bước chân
    if (player.grounded && player.speed > 0.6) {
      bob.current += dt * player.speed * 1.35
      const ph = Math.floor(bob.current / Math.PI)
      if (ph !== lastStep.current) {
        lastStep.current = ph
        audio.step()
      }
    }
    const bobY = player.grounded ? Math.sin(bob.current * 1) * 0.045 * Math.min(1, player.speed / 6) : 0

    // ---- camera ----
    tmpE.set(player.pitch, player.yaw, 0, 'YXZ')
    tmpQ.setFromEuler(tmpE)
    const targetP = tmpV.set(player.pos.x, player.pos.y + bobY, player.pos.z)
    if (trans.active) {
      trans.t += dt / 3.2
      const e = ease(Math.min(1, trans.t))
      camera.position.lerpVectors(trans.fromP, targetP, e)
      camera.quaternion.slerpQuaternions(trans.fromQ, tmpQ, e)
      if (trans.t >= 1) trans.active = false
    } else {
      camera.position.copy(targetP)
      camera.quaternion.copy(tmpQ)
    }

    // ---- hover ----
    if (!s.panel && !s.paused && !trans.active) {
      const found = pick(!s.locked && !s.touch ? true : false)
      hovered.current = found
      const key = found ? found.it.id + found.it.label + (found.it.hint ?? '') : ''
      if (key !== hoverKey.current) {
        hoverKey.current = key
        s.setHover(found ? { label: found.it.label, hint: found.it.hint, hasPanel: !!found.it.panel } : null)
      }
    } else if (hoverKey.current) {
      hoverKey.current = ''
      hovered.current = null
      s.setHover(null)
    }

    audio.update(camera)
  })

  return null
}
