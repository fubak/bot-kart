import * as THREE from 'three';
import type { TrackLayout } from './Track';
import { TEX } from '../core/Textures';

// Sky production: gradient dome shader (horizon glow + sun disc + night
// stars), drifting billboard clouds, and two rings of silhouette peaks.
// One instance persists across track swaps — applyTheme recolors it.

interface Cloud {
  sprite: THREE.Sprite;
  angle: number;
  radius: number;
  speed: number;
}

const DOME_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const DOME_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform float sunSize;
  uniform float sunGlow;
  uniform float stars;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float g = pow(1.0 - max(d.y, 0.0), 1.7);
    vec3 col = mix(topColor, horizonColor, g);
    // Sun/moon disc + halo
    float s = dot(d, normalize(sunDir));
    float disc = smoothstep(sunSize, sunSize + 0.004, s);
    float halo = pow(max(s, 0.0), 20.0) * sunGlow;
    col += sunColor * (disc * 1.2 + halo);
    // Procedural star field (night)
    vec2 sp = vec2(atan(d.z, d.x) * 57.0, d.y * 130.0);
    vec2 cell = floor(sp);
    vec2 f = fract(sp) - 0.5;
    float rnd = hash(cell);
    float star = step(0.993, rnd) * smoothstep(0.16, 0.02, length(f)) * step(0.04, d.y);
    col += vec3(0.85, 0.92, 1.0) * star * stars * (0.4 + 0.6 * hash(cell + 7.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Sky {
  readonly group = new THREE.Group();
  private readonly domeMat: THREE.ShaderMaterial;
  private readonly clouds: Cloud[] = [];
  private readonly mountains = new THREE.Group();

  constructor() {
    this.domeMat = new THREE.ShaderMaterial({
      vertexShader: DOME_VERT,
      fragmentShader: DOME_FRAG,
      uniforms: {
        topColor: { value: new THREE.Color(0x3a6fd8) },
        horizonColor: { value: new THREE.Color(0xbfd9f0) },
        sunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3) },
        sunColor: { value: new THREE.Color(0xfff3dd) },
        sunSize: { value: 0.9993 },
        sunGlow: { value: 0.35 },
        stars: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(430, 40, 20), this.domeMat);
    dome.renderOrder = -100; // paint first — everything else wins depth
    dome.frustumCulled = false;
    this.group.add(dome);

    // Clouds: billboard sprites on a drifting ring. The generated sprite is
    // white-on-black — luminance doubles as the alpha channel.
    const cloudTex = TEX.cloud();
    const rng = (() => { let s = 4242; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff); })();
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex,
        alphaMap: cloudTex,
        transparent: true,
        depthWrite: false,
        fog: false,
        opacity: 0.9,
      });
      const sp = new THREE.Sprite(mat);
      const w = 46 + rng() * 60;
      sp.scale.set(w, w * (0.42 + rng() * 0.2), 1);
      const c: Cloud = {
        sprite: sp,
        angle: rng() * Math.PI * 2,
        radius: 200 + rng() * 190,
        speed: (2.2 + rng() * 2.8) * (rng() < 0.5 ? 1 : -1),
      };
      sp.position.y = 60 + rng() * 120;
      this.clouds.push(c);
      this.group.add(sp);
    }
    this.group.add(this.mountains);
  }

  /** Recolor + rebuild silhouettes for a track theme. */
  applyTheme(theme: NonNullable<TrackLayout['theme']>): void {
    const u = this.domeMat.uniforms;
    const sky = new THREE.Color(theme.sky);
    const night = !!theme.night;
    const top = theme.skyTop !== undefined
      ? new THREE.Color(theme.skyTop)
      : sky.clone().multiplyScalar(0.62).lerp(new THREE.Color(0x2450b0), 0.3);
    const horizon = theme.skyHorizon !== undefined
      ? new THREE.Color(theme.skyHorizon)
      : sky.clone().lerp(new THREE.Color(0xffffff), 0.45);
    // PostFX grade compensation (WS-POST): the dome shader writes linear
    // color that now passes through ACES + sRGB (OutputPass) where it used
    // to hit the canvas verbatim — un-compensated the sky reads pale/washed.
    // Squaring each channel ≈ inverts sRGB-encode for midtones while keeping
    // the authored hue; sun disc/stars are left untouched (they're meant to
    // ride over the bloom gate).
    u.topColor.value.copy(top.multiply(top));
    u.horizonColor.value.copy(horizon.multiply(horizon));
    u.sunDir.value.set(...(theme.sunPos ?? [60, 90, 40])).normalize();
    u.sunColor.value.set(theme.sunColor ?? 0xfff3dd);
    u.sunSize.value = night ? 0.9985 : 0.9993; // moon reads slightly bigger
    u.sunGlow.value = night ? 0.5 : 0.35;
    u.stars.value = theme.stars ?? (night ? 1 : 0);

    // Clouds sit just under the bloom threshold (POSTFX.bloom.threshold ≈
    // linear 1.0): 0.85 keeps them reading white without blooming into a
    // sky-wide haze veil over day tracks (WS-POST).
    const cloudTint = new THREE.Color(theme.cloud ?? 0xffffff).multiplyScalar(0.85);
    for (const c of this.clouds) {
      (c.sprite.material as THREE.SpriteMaterial).color.copy(cloudTint);
    }

    // Silhouette mountain rings — fog is baked into the color instead of
    // sampled at runtime (the far ring sits beyond fog-far and would
    // vanish); nearer = darker, farther = closer to the horizon color.
    this.mountains.clear();
    const rng = (() => { let s = 777; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff); })();
    // Same grade compensation as the dome (squared — was raw, now graded);
    // `horizon` is already compensated so the far ring blends to the dome.
    const base = new THREE.Color(theme.mountain ?? 0x3a5848);
    base.multiply(base);
    for (const [count, rMin, rMax, hMin, hMax, fade] of [
      [16, 250, 310, 22, 55, 0.18],
      [12, 340, 410, 40, 85, 0.5],
    ] as const) {
      const geo = new THREE.ConeGeometry(1, 1, 6, 1);
      const mat = new THREE.MeshBasicMaterial({
        color: base.clone().lerp(horizon, fade),
        fog: false,
      });
      const inst = new THREE.InstancedMesh(geo, mat, count);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rng() * 0.3;
        const r = rMin + rng() * (rMax - rMin);
        const h = hMin + rng() * (hMax - hMin);
        const w = h * (1.4 + rng() * 1.6);
        q.setFromAxisAngle(up, rng() * Math.PI);
        m.compose(
          new THREE.Vector3(Math.cos(a) * r, h * 0.5 - 0.5, Math.sin(a) * r),
          q,
          new THREE.Vector3(w, h, w * 0.7),
        );
        inst.setMatrixAt(i, m);
      }
      this.mountains.add(inst);
    }
  }

  update(dt: number): void {
    for (const c of this.clouds) {
      c.angle += (c.speed * dt) / c.radius * 12; // slow tangential drift
      c.sprite.position.x = Math.cos(c.angle) * c.radius;
      c.sprite.position.z = Math.sin(c.angle) * c.radius;
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        const m = (o as THREE.Mesh).material ?? (o as THREE.Sprite).material;
        for (const mm of Array.isArray(m) ? m : [m]) mm.dispose();
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      }
    });
  }
}
