import { portfolio } from 'ship/portfolioData';
import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { onFrame, VIEW_CENTER_Y } from 'ship/lib/flight';
/* ────────────────────────────────────────────────────────────────────────────
   Deep-space view outside the canopy.
   • nebula: fbm shader baked once into a cubemap (zero per-frame cost)
   • stars: crisp point sprites with diffraction spikes on the bright ones
   • destination: procedural ringed gas giant with atmosphere + mutual shadows
   • motion: z-recycled dust whose streak length follows speed, tumbling rocks
   ──────────────────────────────────────────────────────────────────────────── */
const NOISE = /* glsl */ `
float hash13(vec3 p3){
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float fbm(vec3 p){
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3(17.1, 9.3, 5.7);
    a *= 0.5;
  }
  return s;
}
float hash11(float n){ return fract(sin(n) * 43758.5453123); }
float noise1(float x){
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), f);
}
float ringDensity(float t, float fw){
  float d = 0.5 + 0.5 * noise1(t * 15.0 + 3.0);
  float fine = noise1(t * 52.0 + 9.0);
  d *= mix(0.55 + 0.45 * fine, 0.78, clamp(fw * 52.0, 0.0, 1.0));
  d *= smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.92, 1.0, t));
  d *= 1.0 - 0.9 * (1.0 - smoothstep(0.0, 0.03, abs(t - 0.6)));
  d *= 1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.015, abs(t - 0.27)));
  d *= mix(0.4, 1.0, smoothstep(0.0, 0.3, t));
  return d;
}
`;
const NEBULA_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uAxis;
${NOISE}
void main(){
  vec3 d = normalize(vDir);
  float lat = dot(d, uAxis);
  float band = exp(-lat * lat * 6.5);
  vec3 p = d * 2.1;
  vec3 w = vec3(fbm(p + vec3(1.7, 9.2, 3.1)), fbm(p + vec3(8.3, 2.8, 5.5)), fbm(p + vec3(4.1, 6.6, 0.9))) - 0.5;
  float n1 = fbm(p * 1.3 + w * 2.6);
  float n2 = fbm(p * 2.7 + w * 3.4 + 11.0);
  float n3 = fbm(p * 5.6 - w * 2.0 + 23.0);

  float cloud = smoothstep(0.36, 0.74, n1);
  float fil = smoothstep(0.44, 0.78, n2);
  float dens = cloud * (0.14 + 0.86 * band);

  vec3 base = vec3(0.007, 0.011, 0.024);
  vec3 teal = vec3(0.04, 0.30, 0.42);
  vec3 indigo = vec3(0.13, 0.13, 0.46);
  vec3 violet = vec3(0.44, 0.14, 0.42);
  vec3 ember = vec3(1.0, 0.46, 0.2);

  vec3 col = base;
  col += mix(indigo, teal, smoothstep(-0.12, 0.12, w.x)) * dens * 0.78;
  col += violet * fil * dens * 0.62;
  col += ember * pow(fil * cloud, 2.0) * band * 0.42 * smoothstep(0.42, 0.62, n3 + w.y * 0.6);

  float dust = smoothstep(0.5, 0.7, fbm(p * 3.3 + w * 1.6 + 40.0));
  col *= 1.0 - 0.62 * dust * band;

  // unresolved star haze along the galactic band
  col += vec3(0.09, 0.115, 0.17) * band * band * (0.35 + 0.65 * n3) * 0.55;

  // dither before 8-bit quantisation
  float nz = hash13(vec3(gl_FragCoord.xy, 7.0));
  col += (nz - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;
const DIR_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform samplerCube uSky;
void main(){
  vec3 c = textureCube(uSky, normalize(vDir)).rgb;
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}
`;
const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uDpr;
varying vec3 vColor;
varying float vSpike;
void main(){
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float tw = 0.86 + 0.14 * sin(uTime * (0.7 + aPhase * 1.9) + aPhase * 40.0);
  gl_PointSize = max(aSize * uDpr * 2.4, 1.6);
  vColor = aColor * tw;
  vSpike = smoothstep(3.0, 4.4, aSize);
}
`;
const STAR_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vSpike;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float a = exp(-r * r * 5.5);
  float spikes = (exp(-abs(c.x) * 70.0) + exp(-abs(c.y) * 70.0)) * exp(-r * 3.2);
  a += spikes * vSpike * 0.9;
  a *= 1.0 - smoothstep(0.8, 1.0, r);
  gl_FragColor = vec4(vColor * a, 1.0);
}
`;
const SUN_VERT = /* glsl */ `
uniform float uScale;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uScale;
  gl_Position = projectionMatrix * mv;
}
`;
const SUN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main(){
  vec2 c = (vUv - 0.5) * 2.0;
  float r = length(c);
  float core = exp(-r * r * 1500.0) * 2.4;
  float halo = exp(-r * 13.0) * 0.95 + exp(-r * 4.2) * 0.2;
  float sx = exp(-abs(c.y) * 130.0) * exp(-abs(c.x) * 3.0) * 0.5;
  float sy = exp(-abs(c.x) * 170.0) * exp(-abs(c.y) * 6.5) * 0.28;
  vec3 col = vec3(1.0, 0.95, 0.86) * core
           + vec3(1.0, 0.76, 0.5) * halo
           + vec3(0.62, 0.8, 1.0) * sx
           + vec3(1.0, 0.86, 0.7) * sy;
  col *= 1.0 - smoothstep(0.55, 1.0, r);
  gl_FragColor = vec4(col, 1.0);
}
`;
const POS_VERT = /* glsl */ `
varying vec3 vPos;
void main(){
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const PLANET_FRAG = /* glsl */ `
precision highp float;
varying vec3 vPos;
uniform vec3 uLight;
uniform vec3 uCam;
uniform float uSpin;
uniform float uRingIn;
uniform float uRingOut;
${NOISE}
void main(){
  vec3 N = normalize(vPos);
  vec3 V = normalize(uCam - vPos);
  float cs = cos(uSpin);
  float sn = sin(uSpin);
  vec3 n = vec3(cs * N.x - sn * N.z, N.y, sn * N.x + cs * N.z);
  float lat = n.y;

  float w1 = fbm(vec3(n.x * 2.2, n.y * 5.0, n.z * 2.2) + 3.7);
  float w2 = fbm(vec3(n.x * 5.0, n.y * 11.0, n.z * 5.0) + 9.1);
  float y = lat + (w1 - 0.5) * 0.11 + (w2 - 0.5) * 0.04;

  float band = noise1(y * 7.0 + 2.3) * 0.6 + noise1(y * 17.0 + 11.0) * 0.28 + noise1(y * 41.0 + 5.0) * 0.12;

  vec3 cream = vec3(0.92, 0.82, 0.64);
  vec3 sand = vec3(0.79, 0.58, 0.37);
  vec3 rust = vec3(0.6, 0.3, 0.16);
  vec3 umber = vec3(0.25, 0.14, 0.11);
  vec3 slate = vec3(0.4, 0.43, 0.5);

  vec3 col = mix(rust, sand, smoothstep(0.26, 0.54, band));
  col = mix(col, cream, smoothstep(0.54, 0.8, band));
  col = mix(col, umber, (1.0 - smoothstep(0.12, 0.32, band)) * 0.8);
  col = mix(col, slate, smoothstep(0.6, 0.96, abs(lat)) * 0.6);

  float st = fbm(vec3(n.x * 3.0, y * 36.0, n.z * 3.0) + 1.3);
  col *= 0.8 + 0.4 * st;

  // great storm
  vec3 sc = normalize(vec3(0.5, -0.3, 0.8));
  float sd = length((n - sc) * vec3(1.0, 2.2, 1.0));
  col = mix(col, vec3(0.82, 0.36, 0.2), (1.0 - smoothstep(0.06, 0.2, sd)) * 0.8);
  col = mix(col, cream, smoothstep(0.15, 0.2, sd) * (1.0 - smoothstep(0.2, 0.27, sd)) * 0.35);

  float ndl = dot(N, uLight);
  float day = smoothstep(-0.1, 0.5, ndl);
  float shade = day;

  // shadow cast by the rings
  if (vPos.y * uLight.y < 0.0) {
    float t = -vPos.y / uLight.y;
    vec3 h = vPos + uLight * t;
    float rt = (length(h.xz) - uRingIn) / (uRingOut - uRingIn);
    if (rt > 0.0 && rt < 1.0) shade *= 1.0 - 0.62 * ringDensity(rt, 0.02);
  }

  vec3 lit = col * shade * 1.12;
  float term = smoothstep(-0.18, 0.06, ndl) * (1.0 - smoothstep(0.06, 0.42, ndl));
  lit += col * vec3(1.0, 0.42, 0.18) * term * 0.16;
  lit += col * vec3(0.05, 0.08, 0.14) * 0.2;

  float nv = max(dot(N, V), 0.0);
  float fres = pow(1.0 - nv, 2.6);
  float sunSide = smoothstep(-0.25, 0.3, ndl);
  lit = mix(lit, vec3(0.74, 0.86, 1.0) * (0.08 + 0.92 * day), fres * 0.6 * (0.15 + 0.85 * sunSide));
  lit *= 0.78 + 0.22 * sqrt(nv);

  gl_FragColor = vec4(lit, 1.0);
}
`;
const ATMO_FRAG = /* glsl */ `
precision highp float;
varying vec3 vPos;
uniform vec3 uLight;
uniform vec3 uCam;
uniform float uLimb;
void main(){
  vec3 N = normalize(vPos);
  vec3 V = normalize(uCam - vPos);
  float d = clamp(-dot(N, V) / uLimb, 0.0, 1.0);
  float a = pow(d, 2.4);
  float ndl = dot(N, uLight);
  float day = smoothstep(-0.3, 0.55, ndl);
  vec3 col = mix(vec3(1.0, 0.6, 0.36), vec3(0.6, 0.8, 1.0), smoothstep(-0.1, 0.5, ndl));
  gl_FragColor = vec4(col * a * day * 0.62, 1.0);
}
`;
const RING_VERT = /* glsl */ `
varying vec2 vP;
void main(){
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const RING_FRAG = /* glsl */ `
precision highp float;
varying vec2 vP;
uniform vec3 uLight;
uniform float uRadius;
uniform float uRingIn;
uniform float uRingOut;
${NOISE}
void main(){
  float r = length(vP);
  float t = (r - uRingIn) / (uRingOut - uRingIn);
  if (t <= 0.0 || t >= 1.0) discard;
  float d = ringDensity(t, fwidth(t));
  vec3 pp = vec3(vP.x, 0.0, vP.y);
  float along = dot(pp, uLight);
  float dist = length(pp - along * uLight);
  float sh = along < 0.0 ? smoothstep(uRadius * 0.985, uRadius * 1.05, dist) : 1.0;
  vec3 tint = mix(vec3(0.7, 0.55, 0.4), vec3(0.97, 0.9, 0.79), noise1(t * 13.0 + 1.0));
  vec3 col = tint * mix(0.03, 1.0, sh) * (0.5 + 0.5 * d);
  gl_FragColor = vec4(col, d * 0.92);
}
`;
const DUST_VERT = /* glsl */ `
attribute float aEnd;
attribute float aRand;
uniform float uTravel;
uniform float uStreak;
uniform float uDepth;
uniform float uDpr;
uniform float uPoint;
varying float vA;
void main(){
  float z = mod(position.z + uTravel, uDepth) - uDepth;
  float zz = z - aEnd * uStreak * (0.6 + 0.8 * aRand);
  vec4 mv = viewMatrix * vec4(position.xy, zz, 1.0);
  gl_Position = projectionMatrix * mv;
  float fadeFar = smoothstep(-uDepth, -uDepth * 0.55, z);
  float fadeNear = 1.0 - smoothstep(-14.0, -1.0, z);
  float prox = clamp(70.0 / max(-z, 1.0), 0.0, 1.0);
  vA = fadeFar * fadeNear * (0.12 + 0.88 * prox) * (0.35 + 0.65 * aRand) * (1.0 - aEnd);
  gl_PointSize = uPoint * clamp(uDpr * 90.0 / max(-mv.z, 1.0), 1.0, 3.2 * uDpr);
}
`;
const DUST_FRAG = /* glsl */ `
precision highp float;
varying float vA;
uniform vec3 uColor;
uniform float uGain;
uniform float uRound;
void main(){
  float a = vA * uGain;
  if (uRound > 0.5) {
    vec2 c = gl_PointCoord - 0.5;
    a *= exp(-dot(c, c) * 14.0);
  }
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;
function mulberry32(seed) {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
const PLANET_R = 128;
const RING_IN = PLANET_R * 1.32;
const RING_OUT = PLANET_R * 2.18;
const DEPTH = 900;
export default function SpaceScene() {
    const hostRef = useRef(null);
    useEffect(() => {
        const host = hostRef.current;
        if (!host)
            return;
        const reportFailure = (reason) => {
            host.dataset.fallback = 'true';
            window.parent.postMessage({
                type: 'ORBITA_SPACE_RENDERER_FAILED', reason,
            }, window.location.origin);
            window.dispatchEvent(new Event('ORBITA_SPACE_LOCAL_FAILED'));
        };
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        }
        catch (error) {
            reportFailure('webgl-create: ' + String(error));
            return;
        }
        renderer.setClearColor(0x02040a, 1);
        host.appendChild(renderer.domElement);
        const rnd = mulberry32(20240412);
        const disposables = [];
        const track = (o) => {
            disposables.push(o);
            return o;
        };
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(58, 1, 0.035, 6000);
        scene.add(camera);
        camera.rotation.order = 'YXZ';
        /* ── sky group: everything "at infinity", rotates as the ship steers ── */
        const sky = new THREE.Group();
        scene.add(sky);
        const bandAxis = new THREE.Vector3(-0.5, 0.86, 0.12).normalize();
        // nebula → cubemap (baked once)
        const cubeSize = Math.min(1024, renderer.capabilities.maxCubemapSize);
        const cubeRT = track(new THREE.WebGLCubeRenderTarget(cubeSize, {
            generateMipmaps: false,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
        }));
        {
            const bakeScene = new THREE.Scene();
            const geo = new THREE.SphereGeometry(10, 48, 32);
            const mat = new THREE.ShaderMaterial({
                vertexShader: DIR_VERT,
                fragmentShader: NEBULA_FRAG,
                uniforms: { uAxis: { value: bandAxis } },
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false,
            });
            bakeScene.add(new THREE.Mesh(geo, mat));
            const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
            cubeCam.update(renderer, bakeScene);
            geo.dispose();
            mat.dispose();
        }
        const skyMesh = new THREE.Mesh(track(new THREE.SphereGeometry(3000, 48, 32)), track(new THREE.ShaderMaterial({
            vertexShader: DIR_VERT,
            fragmentShader: SKY_FRAG,
            uniforms: { uSky: { value: cubeRT.texture } },
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
        })));
        skyMesh.renderOrder = -100;
        skyMesh.frustumCulled = false;
        sky.add(skyMesh);
        // stars
        const STARS = 9000;
        const sPos = new Float32Array(STARS * 3);
        const sCol = new Float32Array(STARS * 3);
        const sSize = new Float32Array(STARS);
        const sPhase = new Float32Array(STARS);
        const v = new THREE.Vector3();
        for (let i = 0; i < STARS;) {
            const u = rnd() * 2 - 1;
            const th = rnd() * Math.PI * 2;
            const s = Math.sqrt(1 - u * u);
            v.set(s * Math.cos(th), u, s * Math.sin(th));
            const lat = v.dot(bandAxis);
            if (rnd() > 0.2 + 0.8 * Math.exp(-lat * lat * 6.5))
                continue;
            sPos.set([v.x * 2400, v.y * 2400, v.z * 2400], i * 3);
            sSize[i] = 0.85 + Math.pow(rnd(), 10) * 4.6 + rnd() * 0.75;
            const tone = rnd();
            const b = 0.32 + rnd() * 0.68;
            const c = tone < 0.58 ? [0.76, 0.86, 1] : tone < 0.84 ? [1, 0.97, 0.92] : tone < 0.95 ? [1, 0.84, 0.64] : [1, 0.66, 0.5];
            sCol.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
            sPhase[i] = rnd();
            i++;
        }
        const starGeo = track(new THREE.BufferGeometry());
        starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        starGeo.setAttribute('aColor', new THREE.BufferAttribute(sCol, 3));
        starGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
        starGeo.setAttribute('aPhase', new THREE.BufferAttribute(sPhase, 1));
        const starMat = track(new THREE.ShaderMaterial({
            vertexShader: STAR_VERT,
            fragmentShader: STAR_FRAG,
            uniforms: { uTime: { value: 0 }, uDpr: { value: 1 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        const stars = new THREE.Points(starGeo, starMat);
        stars.frustumCulled = false;
        sky.add(stars);
        // sun
        const sun = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 1)), track(new THREE.ShaderMaterial({
            vertexShader: SUN_VERT,
            fragmentShader: SUN_FRAG,
            uniforms: { uScale: { value: 900 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        })));
        sun.position.set(-218, 266, -1350).multiplyScalar(1.3);
        sun.frustumCulled = false;
        sky.add(sun);
        // destination planet
        const pivot = new THREE.Group();
        pivot.position.set(116, 138, -1100);
        pivot.rotation.set(0.4, 0, 0.3);
        sky.add(pivot);
        const lightSky = new THREE.Vector3(-0.72, 0.36, 0.6).normalize();
        const lightObj = lightSky.clone().applyQuaternion(pivot.quaternion.clone().invert());
        const camObj = new THREE.Vector3();
        const shell = 1.075;
        const planetMat = track(new THREE.ShaderMaterial({
            vertexShader: POS_VERT,
            fragmentShader: PLANET_FRAG,
            uniforms: {
                uLight: { value: lightObj },
                uCam: { value: camObj },
                uSpin: { value: 0 },
                uRingIn: { value: RING_IN },
                uRingOut: { value: RING_OUT },
            },
        }));
        pivot.add(new THREE.Mesh(track(new THREE.SphereGeometry(PLANET_R, 128, 80)), planetMat));
        const ring = new THREE.Mesh(track(new THREE.RingGeometry(RING_IN, RING_OUT, 192, 1)), track(new THREE.ShaderMaterial({
            vertexShader: RING_VERT,
            fragmentShader: RING_FRAG,
            uniforms: {
                uLight: { value: lightObj },
                uRadius: { value: PLANET_R },
                uRingIn: { value: RING_IN },
                uRingOut: { value: RING_OUT },
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        })));
        ring.rotation.x = Math.PI / 2;
        ring.renderOrder = 1;
        pivot.add(ring);
        const atmo = new THREE.Mesh(track(new THREE.SphereGeometry(PLANET_R * shell, 96, 64)), track(new THREE.ShaderMaterial({
            vertexShader: POS_VERT,
            fragmentShader: ATMO_FRAG,
            uniforms: {
                uLight: { value: lightObj },
                uCam: { value: camObj },
                uLimb: { value: Math.sqrt(1 - 1 / (shell * shell)) },
            },
            transparent: true,
            depthWrite: false,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
        })));
        atmo.renderOrder = 2;
        pivot.add(atmo);
        /* ── local space: dust + rocks streaming past the hull ── */
        const DUST = 2200;
        const linePos = new Float32Array(DUST * 6);
        const lineEnd = new Float32Array(DUST * 2);
        const lineRand = new Float32Array(DUST * 2);
        const ptPos = new Float32Array(DUST * 3);
        const ptEnd = new Float32Array(DUST);
        const ptRand = new Float32Array(DUST);
        for (let i = 0; i < DUST; i++) {
            const ang = rnd() * Math.PI * 2;
            const rad = 5 + Math.pow(rnd(), 0.62) * 170;
            const x = Math.cos(ang) * rad;
            const y = Math.sin(ang) * rad;
            const z = rnd() * DEPTH;
            const r = rnd();
            linePos.set([x, y, z, x, y, z], i * 6);
            lineEnd.set([0, 1], i * 2);
            lineRand.set([r, r], i * 2);
            ptPos.set([x, y, z], i * 3);
            ptRand[i] = r;
        }
        const dustUniforms = {
            uTravel: { value: 0 },
            uStreak: { value: 1 },
            uDepth: { value: DEPTH },
            uDpr: { value: 1 },
            uColor: { value: new THREE.Color(0.74, 0.87, 1) },
            uGain: { value: 1 },
        };
        const lineGeo = track(new THREE.BufferGeometry());
        lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
        lineGeo.setAttribute('aEnd', new THREE.BufferAttribute(lineEnd, 1));
        lineGeo.setAttribute('aRand', new THREE.BufferAttribute(lineRand, 1));
        const lineMat = track(new THREE.ShaderMaterial({
            vertexShader: DUST_VERT,
            fragmentShader: DUST_FRAG,
            uniforms: { ...dustUniforms, uPoint: { value: 1 }, uRound: { value: 0 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        const lines = new THREE.LineSegments(lineGeo, lineMat);
        lines.frustumCulled = false;
        lines.renderOrder = 5;
        scene.add(lines);
        const ptGeo = track(new THREE.BufferGeometry());
        ptGeo.setAttribute('position', new THREE.BufferAttribute(ptPos, 3));
        ptGeo.setAttribute('aEnd', new THREE.BufferAttribute(ptEnd, 1));
        ptGeo.setAttribute('aRand', new THREE.BufferAttribute(ptRand, 1));
        const ptMat = track(new THREE.ShaderMaterial({
            vertexShader: DUST_VERT,
            fragmentShader: DUST_FRAG,
            uniforms: { ...dustUniforms, uPoint: { value: 1.5 }, uRound: { value: 1 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        const points = new THREE.Points(ptGeo, ptMat);
        points.frustumCulled = false;
        points.renderOrder = 5;
        scene.add(points);
        // asteroids
        const rockGeo = track(new THREE.IcosahedronGeometry(1, 3));
        {
            const pos = rockGeo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i).normalize();
                const d = 1 +
                    0.26 * Math.sin(v.x * 3.1 + 1.3) * Math.sin(v.y * 2.7 + 0.4) +
                    0.17 * Math.sin(v.z * 5.3 + v.x * 4.1) +
                    0.09 * Math.sin(v.y * 11 + v.z * 9) +
                    0.05 * Math.sin(v.x * 19 + v.y * 17 + v.z * 13);
                pos.setXYZ(i, v.x * d, v.y * d, v.z * d);
            }
            rockGeo.computeVertexNormals();
        }
        const rockMat = track(new THREE.MeshStandardMaterial({ color: 0x756d66, roughness: 1, metalness: 0, flatShading: true }));
        const ROCKS = 40;
        const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCKS);
        rocks.frustumCulled = false;
        scene.add(rocks);
        const spawn = (rock, initial) => {
            const ang = rnd() * Math.PI * 2;
            const rad = 18 + Math.pow(rnd(), 0.75) * 150;
            const size = 0.7 + Math.pow(rnd(), 3) * 6.5;
            const r = rock ?? { x: 0, y: 0, z: 0, s: new THREE.Vector3(), axis: new THREE.Vector3(), rot: 0, w: 0 };
            r.x = Math.cos(ang) * rad;
            r.y = Math.sin(ang) * rad * 0.8;
            r.z = initial ? -60 - rnd() * 760 : -820 - rnd() * 80;
            r.s.set(size * (0.75 + rnd() * 0.5), size * (0.65 + rnd() * 0.5), size * (0.75 + rnd() * 0.5));
            r.axis.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
            r.rot = rnd() * 6.28;
            r.w = (rnd() - 0.5) * 0.9;
            return r;
        };
        const rockData = Array.from({ length: ROCKS }, () => spawn(null, true));
        const sunLight = new THREE.DirectionalLight(0xffe6c4, 4.4);
        const fill = new THREE.DirectionalLight(0x4a86d8, 0.9);
        fill.position.set(0.7, -0.5, -0.3);
        scene.add(sunLight, fill, new THREE.AmbientLight(0x22344f, 1));
        /* ── sizing ── */
        const size = { w: 1, h: 1 };
        const resize = () => {
            const w = Math.max(1, window.innerWidth);
            const h = Math.max(1, window.innerHeight);
            const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6.5e6 / (w * h))));
            renderer.setPixelRatio(dpr);
            renderer.setSize(w, h, false);
            // shift the principal point up so the flight vector sits above the dashboard
            const shift = (0.5 - VIEW_CENTER_Y) * h;
            const fullH = h + 2 * shift;
            camera.aspect = w / fullH;
            camera.setViewOffset(w, fullH, 0, 2 * shift, w, h);
            starMat.uniforms.uDpr.value = dpr;
            dustUniforms.uDpr.value = dpr;
            size.w = w;
            size.h = h;
        };
        resize();
        window.addEventListener('resize', resize);
        /* ── frame ── */
        const m4 = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const p3 = new THREE.Vector3();
        const tmp = new THREE.Vector3();
        let realRenderedFrames = 0;
        let firstPaintAcknowledged = false;
        let rendererFailed = false;
        let cancelled = false;
        let cockpitEnvironment = null;
        let modelReady = false;
        let startModel = false;
        let hx = null;
        let cinematicTime = 0;
        let fabricationReady = false;
        let lastCueName = '';
        const diagnosticSpeed = Math.max(1, Math.min(30, Number(new URLSearchParams(location.search).get('hx9DiagnosticSpeed')) || 1));
        let introCompleted = false;
        const parts = new Map();
        const fabrication = new Map();
        const screens = [];
        const cockpitRoot = new THREE.Group();
        cockpitRoot.position.set(0, 0, -5);
        scene.add(cockpitRoot);
        const progress = text => window.dispatchEvent(new CustomEvent('orbita-hx9-progress', {detail:text}));
        const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        async function buildModel() {
            try {
                progress('Đang chuẩn bị ghế phi công HX-9…');
                await nextPaint();
                hx = await import('ship/hx9');
                if (cancelled) return;
                const names = ['seat', 'dashboard', 'controls', 'structure', 'shell', 'glass'];
                // Request all parts immediately but prioritise the first visible
                // part. Decode in reveal order as each download becomes ready;
                // a slow later request must not delay the first frame of the seat.
                // Turn failures into values so later requests cannot reject before
                // the ordered consumer reaches them.
                const downloads = names.map((name, index) => fetch(
                    new URL('model/' + name + '.glb', document.baseURI),
                    { priority: index === 0 ? 'high' : 'low' }
                ).then(response => {
                    if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
                    return response.arrayBuffer();
                }).then(buffer => ({ buffer }), error => ({ error })));
                const envSource = hx.environmentTexture();
                const pmrem = new THREE.PMREMGenerator(renderer);
                cockpitEnvironment = pmrem.fromEquirectangular(envSource);
                envSource.dispose(); pmrem.dispose();
                const key = new THREE.DirectionalLight(0xffe1c4, 2.65);
                key.position.set(2.8, 4.4, 1.9); key.target.position.set(0, -.28, -.35);
                const fillCabin = new THREE.PointLight(0x84e2ff, 0, 6.5, 2);
                fillCabin.position.set(-.38, .28, -.18);
                const ambientCabin = new THREE.HemisphereLight(0x88a4b0, 0x263136, 1.45);
                for (const light of [key, fillCabin, ambientCabin]) { light.layers.set(1); cockpitRoot.add(light); }
                cockpitRoot.add(key.target);
                cockpitRoot.userData.fill = fillCabin;
                camera.layers.enable(1);
                const loader = new hx.GLTFLoader();
                for (const [index, name] of names.entries()) {
                    if (cancelled || rendererFailed) return;
                    const download = await downloads[index];
                    if (download.error) throw download.error;
                    const result = await loader.parseAsync(download.buffer, new URL('model/', document.baseURI).href);
                    if (cancelled || rendererFailed) return;
                    const part = result.scene;
                    const uniforms = hx.createFabricationUniforms();
                    const patched = new WeakSet();
                    part.visible = false;
                    part.traverse(o => {
                        o.layers.set(1);
                        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
                        for (const mat of mats) if ('envMap' in mat && !mat.envMap) mat.envMap = cockpitEnvironment.texture;
                        if (o.userData.hx9Screen !== undefined && o.isMesh && o.material && !Array.isArray(o.material)) {
                            o.material = o.material.clone();
                            screens.push({ mesh:o, index:Number(o.userData.hx9Screen), base:o.material.color.clone() });
                            o.material.color.setRGB(0,0,0);
                        }
                        const actual = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
                        for (const mat of actual) if (!patched.has(mat)) { patched.add(mat); hx.patchFabrication(mat, uniforms); }
                    });
                    cockpitRoot.add(part);
                    part.updateWorldMatrix(true, true);
                    const bounds = new THREE.Box3().setFromObject(part);
                    if (bounds.isEmpty()) throw Error('Empty fabrication bounds: ' + name);
                    fabrication.set(name, { uniforms, bounds });
                    parts.set(name, part);
                    if (index === 0) fabricationReady = true;
                    await nextPaint();
                }
            } catch (error) { if (!cancelled) reportFailure('cockpit-load: ' + String(error)); }
        }
        // The three main displays are the real HX-9 screen meshes, not DOM
        // approximations. Canvas textures use large type and high contrast so
        // they stay legible after projection onto the model's small screens.
        const interactiveScreens = [];
        function makeDisplay(index) {
            const screen = screens.find(s => s.index === index);
            if (!screen) return;
            const wide = index === 0;
            const canvas = document.createElement('canvas');
            canvas.width = wide ? 1536 : 1024; canvas.height = wide ? 768 : 768;
            const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
            const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#071725');bg.addColorStop(1,'#020a12');
            c.fillStyle=bg;c.fillRect(0,0,w,h);
            c.strokeStyle='rgba(96,202,230,.09)';c.lineWidth=2;
            for(let x=0;x<w;x+=80){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}
            for(let y=0;y<h;y+=80){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
            c.fillStyle='#5fdef2';c.fillRect(0,0,w,9);
            c.fillStyle='#67d3e6';c.font='700 36px system-ui, sans-serif';
            c.fillText(index===0?portfolio.labels.profile:index===2?portfolio.labels.project:portfolio.labels.connect,54,72);
            c.fillStyle='#b7d6e3';c.font='600 34px system-ui, sans-serif';
            if (index===0) {
                c.fillText(portfolio.focus,54,137);
                c.fillStyle='#f5fbff';c.font='800 95px system-ui, sans-serif';c.fillText(portfolio.name,54,267);
                c.fillStyle='#a6c9d8';c.font='600 39px system-ui, sans-serif';c.fillText(portfolio.headline,54,342);
                c.fillStyle='#78e0ed';c.fillRect(54,405,6,72);
                c.fillStyle='#dceff5';c.font='500 36px system-ui, sans-serif';
                c.fillText(portfolio.summary[0],82,436);
                c.fillText(portfolio.summary[1],82,484);
                c.fillStyle='#adf2ff';c.fillRect(54,576,720,112);
                c.fillStyle='#06131c';c.font='800 40px system-ui, sans-serif';c.fillText(portfolio.labels.enter+'  ↗',85,648);
            } else if (index===2) {
                c.fillStyle='#f4fbff';c.font='800 78px system-ui, sans-serif';c.fillText(portfolio.project.title,54,184);
                c.fillStyle='#bdd4e0';c.font='600 48px system-ui, sans-serif';c.fillText(portfolio.project.description,54,257);
                c.fillStyle='#70e1ec';c.fillRect(54,309,6,85);
                c.fillStyle='#d3e5eb';c.font='700 44px system-ui, sans-serif';c.fillText(portfolio.corava.title,78,350);
                c.font='600 38px system-ui, sans-serif';c.fillText(portfolio.corava.role,78,405);
                c.fillStyle='#b3f4ff';c.fillRect(54,555,735,116);
                c.fillStyle='#06131c';c.font='800 38px system-ui, sans-serif';c.fillText(portfolio.project.action+'  ↗',82,627);
            } else {
                c.fillStyle='#f4fbff';c.font='800 77px system-ui, sans-serif';c.fillText('KẾT NỐI',54,184);
                c.fillStyle='#bdd4e0';c.font='500 38px system-ui, sans-serif';c.fillText(portfolio.connectIntro[0],54,257);c.fillText(portfolio.connectIntro[1],54,310);
                c.fillStyle='#b3f4ff';c.fillRect(54,379,720,111);c.fillStyle='#06131c';c.font='800 43px system-ui, sans-serif';c.fillText('LINKEDIN  ↗',82,449);
                c.fillStyle='#142e3b';c.fillRect(54,525,720,111);c.strokeStyle='#72d7e7';c.strokeRect(54,525,720,111);c.fillStyle='#d9f9ff';c.fillText('GITHUB  ↗',82,595);
            }
            c.fillStyle='#7599aa';c.font='600 24px system-ui, sans-serif';c.fillText(portfolio.labels.hint,54,h-34);
            const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
            tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
            screen.mesh.material.map=tex;screen.mesh.material.needsUpdate=true;
            interactiveScreens.push(screen);
        }
        let displaysAdded=false;
        function addDisplays() {
            if (displaysAdded) return;
            if (![0,2,3].every(i=>screens.some(s=>s.index===i))) return;
            displaysAdded=true;
            for(const i of [0,2,3]) makeDisplay(i);
        }
        const screenRaycaster = new THREE.Raycaster(), screenPointer = new THREE.Vector2();
        screenRaycaster.layers.set(1);
        const onScreenClick = event => {
            if (!introCompleted || event.button !== 0) return;
            const rect=renderer.domElement.getBoundingClientRect();
            screenPointer.set((event.clientX-rect.left)/rect.width*2-1, 1-(event.clientY-rect.top)/rect.height*2);
            screenRaycaster.setFromCamera(screenPointer,camera);
            const hit=screenRaycaster.intersectObjects(interactiveScreens.map(s=>s.mesh),false)[0];
            if (!hit) return;
            const screen=interactiveScreens.find(s=>s.mesh===hit.object);
            if (screen.index===0) window.dispatchEvent(new Event('orbita-hx9-enter'));
            else if (screen.index===2) window.open(portfolio.project.url,'_blank','noopener,noreferrer');
            else window.open(hit.uv.y > .345 ? portfolio.links.linkedin : portfolio.links.github,'_blank','noopener,noreferrer');
        };
        renderer.domElement.addEventListener('click',onScreenClick);
        const orbitPosition = new THREE.Vector3();
        const dockPosition = new THREE.Vector3(0, .135, -4.58);
        const orbitLook = new THREE.Vector3(0, -.1, -5);
        const dockLook = new THREE.Vector3(0, -.085, -5.72);
        const lookTarget = new THREE.Vector3();
        function animateCockpit(t, dt) {
            const angle = -.95 + Math.sin(t*.075)*.12;
            orbitPosition.set(Math.sin(angle)*3.5, 1.55+Math.sin(t*.12)*.10, -5+Math.cos(angle)*3.5);
            if (hx) {
                let cap = hx.CINEMATIC_END;
                for (const cue of hx.ASSEMBLY_CUES) if (!parts.has(cue.name)) { cap = cue.start; break; }
                if (fabricationReady) cinematicTime = Math.min(cap, cinematicTime + Math.min(dt,.05)*diagnosticSpeed);
                const cueNow = [...hx.ASSEMBLY_CUES].reverse().find(c => parts.has(c.name) && cinematicTime >= c.start);
                if (cueNow && cueNow.name !== lastCueName) {
                    lastCueName = cueNow.name;
                    const labels = { structure:'Khung kết cấu đang hình thành…', shell:'Vỏ tàu đang hình thành…', seat:'Ghế phi công đang hình thành…', dashboard:'Bảng điều khiển đang hình thành…', controls:'Thiết bị điều khiển đang hình thành…', glass:'Kính buồng lái đang hình thành…' };
                    progress(labels[lastCueName]);
                }
                window.__orbitaHx9 = {time:cinematicTime, cue:lastCueName, loaded:parts.size, complete:introCompleted};
                for (const cue of hx.ASSEMBLY_CUES) {
                    const part = parts.get(cue.name), state=fabrication.get(cue.name);
                    if (!part || !state) continue;
                    const phase=THREE.MathUtils.clamp((cinematicTime-cue.start)/cue.duration,0,1);
                    part.visible=cinematicTime>=cue.start;
                    state.uniforms.uTime.value=t;
                    state.uniforms.uComplete.value=phase>=1?1:0;
                    state.uniforms.uScanY.value=hx.fabricationScan(state.bounds.min.y,state.bounds.max.y,phase);
                }
                const dock = hx.cameraDock(cinematicTime);
                // Cross above the canopy before settling into the pilot eye,
                // avoiding the solid aft bulkhead during the camera transition.
                const top = new THREE.Vector3(0, 1.35, -4.58);
                if (dock < .55) camera.position.copy(orbitPosition).lerp(top, dock / .55);
                else camera.position.copy(top).lerp(dockPosition, (dock - .55) / .45);
                lookTarget.copy(orbitLook).lerp(dockLook,dock);
                // First see the unchanged distant planet, then reveal the work bay.
                const reveal = THREE.MathUtils.smoothstep(cinematicTime, .4, 3.4);
                camera.position.lerp(new THREE.Vector3(0,0,0), 1-reveal);
                lookTarget.lerp(new THREE.Vector3(.53,.63,-5), 1-reveal);
                camera.lookAt(lookTarget);
                for (const screen of screens) screen.mesh.material.color.copy(screen.base).multiplyScalar(hx.screenPower(cinematicTime,screen.index));
                if (cockpitRoot.userData.fill) cockpitRoot.userData.fill.intensity=3.6*hx.screenPower(cinematicTime,0);
                if (cinematicTime >= hx.POWER_START - .5) addDisplays();
                if (cinematicTime >= hx.CINEMATIC_END && !introCompleted && parts.size === 6) {
                    introCompleted = true;
                    progress('Phi thuyền sẵn sàng · mời bạn khởi hành.');
                    modelReady = true;
                }
            } else {
                camera.position.set(0,0,0); camera.lookAt(.53,.63,-5);
            }
        }
        const onContextLost = (e) => {
            e.preventDefault();
            rendererFailed = true;
            reportFailure('webgl-context-lost');
        };
        renderer.domElement.addEventListener('webglcontextlost', onContextLost);
        const off = onFrame((f, dt) => {
            if (rendererFailed)
                return;
            const t = f.time;
            const rush = smooth(1.3, 9, f.speed);
            sky.rotation.set(f.pitch, f.yaw, 0);
            const shake = f.reduced ? 0 : Math.max(0, f.speed - 1.5) * 0.0007;
            animateCockpit(t, dt);
            if (introCompleted) {
                camera.rotation.x += -f.lookY * .028 + Math.sin(t * 47.3) * shake;
                camera.rotation.y += -f.lookX * .05 + Math.sin(t * 59.1 + 1.7) * shake;
                camera.rotation.z -= f.bank;
            }
            const fov = 58 + rush * 24;
            if (Math.abs(fov - camera.fov) > 0.01) {
                camera.fov = fov;
                camera.updateProjectionMatrix();
            }
            starMat.uniforms.uTime.value = t;
            planetMat.uniforms.uSpin.value = t * 0.012;
            dustUniforms.uTravel.value = f.travel % DEPTH;
            dustUniforms.uStreak.value = 1.6 + f.speed * f.speed * 1.2;
            dustUniforms.uGain.value = 0.85 + rush * 0.9;
            const adv = f.speed * 55 * dt;
            for (let i = 0; i < ROCKS; i++) {
                const r = rockData[i];
                r.z += adv;
                r.rot += r.w * dt;
                if (r.z > 10)
                    spawn(r, false);
                const grow = smooth(-880, -760, r.z);
                q.setFromAxisAngle(r.axis, r.rot);
                p3.set(r.x, r.y, r.z);
                tmp.copy(r.s).multiplyScalar(grow);
                m4.compose(p3, q, tmp);
                rocks.setMatrixAt(i, m4);
            }
            rocks.instanceMatrix.needsUpdate = true;
            camera.updateMatrixWorld();
            sky.updateMatrixWorld(true);
            sunLight.position.copy(lightSky).transformDirection(sky.matrixWorld).multiplyScalar(100);
            camObj.copy(camera.position);
            pivot.worldToLocal(camObj);
            try {
                renderer.render(scene, camera);
            }
            catch (error) {
                rendererFailed = true;
                reportFailure('first-space-render: ' + String(error));
                return;
            }
            // The original space gets its own first paints before construction.
            // Orbita is not mounted until every real cockpit assembly has been
            // built and the combined scene has submitted a frame.
            realRenderedFrames++;
            if (!startModel && realRenderedFrames >= 2) {
                startModel = true;
                progress('Không gian đã mở · chuẩn bị phi thuyền HX-9…');
                requestAnimationFrame(() => { if (!cancelled) void buildModel(); });
            }
            if (modelReady && !firstPaintAcknowledged) {
                firstPaintAcknowledged = true;
                requestAnimationFrame(() => {
                    if (cancelled || rendererFailed) return;
                    progress('Phi thuyền sẵn sàng · mời bạn khởi hành.');
                    window.__orbitaSpacePainted = true;
                    window.dispatchEvent(new Event('ORBITA_SPACE_LOCAL_PAINTED'));
                    window.parent.postMessage({ type: 'ORBITA_SPACE_FRAME_READY', renderedFrames: realRenderedFrames, programCount: renderer.info.programs?.length ?? 0 }, window.location.origin);
                });
            }
            // project the destination for the HUD marker
            pivot.getWorldPosition(tmp);
            const dist = tmp.length();
            tmp.project(camera);
            f.targetX = (tmp.x * 0.5 + 0.5) * size.w;
            f.targetY = (-tmp.y * 0.5 + 0.5) * size.h;
            f.targetR = (PLANET_R / dist) * camera.projectionMatrix.elements[5] * size.h * 0.5;
            f.targetVisible = tmp.z < 1;
        });
        const release = () => {
            if (cancelled) return;
            cancelled = true;
            window.removeEventListener('ORBITA_SPACE_RELEASE', release);
            cockpitRoot.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
                for (const mat of mats) { for (const value of Object.values(mat)) if (value?.isTexture) value.dispose(); mat.dispose(); }
            });
            cockpitEnvironment?.dispose();
            off();
            renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
            renderer.domElement.removeEventListener('click', onScreenClick);
            window.removeEventListener('resize', resize);
            disposables.forEach((d) => d.dispose());
            rocks.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
        };
        window.addEventListener('ORBITA_SPACE_RELEASE', release);
        return release;
    }, []);
    return _jsx("div", { ref: hostRef, className: "space-host", "aria-hidden": "true" });
}
