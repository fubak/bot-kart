import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { POSTFX } from '../config/tuning';

// Post-processing pipeline (WS-POST): the game renders flat through
// renderer.render() — this wraps the frame in an EffectComposer so the
// image reads at production quality.
//
// Chain (all render-side; the fixed-dt sim is untouched):
//   RenderPass      scene → linear HDR HalfFloat target (MSAA, no tonemap —
//                       three skips material tonemapping into render targets)
//   UnrealBloomPass thresholded luminance high-pass → only emissives and
//                   specular highlights bloom (neon pylons, item glows,
//                   boost flames, headlight lamps); day-track diffuse stays
//                   under the gate. Internal mips start at half-res.
//   OutputPass      ACES filmic tonemap + sRGB — reads renderer.toneMapping/
//                   toneMappingExposure, so the grade stays identical to the
//                   old direct-render look.
//   GradePass       display-space finish: vignette, micro contrast/sat,
//                   and a speed-gated radial chromatic edge (2 extra taps,
//                   disengages under reduced-motion).

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: POSTFX.grade.vignette },
    uVignetteStart: { value: POSTFX.grade.vignetteStart },
    uSaturation: { value: POSTFX.grade.saturation },
    uContrast: { value: POSTFX.grade.contrast },
    uAberration: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uVignetteStart;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uAberration;
    varying vec2 vUv;

    void main() {
      vec2 c = vUv - 0.5;
      // Radial distance: 0 center → 1.0 at the corners of a square frame.
      float r = length( c ) * 2.0;

      // Speed-linked chromatic edge — the offset only grows toward the
      // corners so the kart/center stays sharp and readable at any speed.
      // uAberration == 0 collapses the three taps to one (free when off).
      vec2 off = c * uAberration * smoothstep( 0.15, 1.0, r );
      vec3 col;
      col.r = texture2D( tDiffuse, vUv - off ).r;
      col.g = texture2D( tDiffuse, vUv ).g;
      col.b = texture2D( tDiffuse, vUv + off ).b;

      // Micro-grade: contrast around a 0.5 pivot, saturation around luma.
      col = ( col - 0.5 ) * uContrast + 0.5;
      float luma = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      col = mix( vec3( luma ), col, uSaturation );

      // Vignette: untouched inside uVignetteStart, smooth corner rolloff.
      float vig = 1.0 - uVignette * smoothstep( uVignetteStart, 1.5, r );
      col *= vig;

      gl_FragColor = vec4( clamp( col, 0.0, 1.0 ), 1.0 );
    }
  `,
};

export class PostFX {
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private aberration = 0; // smoothed current value (eases toward target)

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    // MSAA in-pipeline: antialias:true on the renderer only covers the
    // default framebuffer — the composer renders into its own targets, so
    // request samples on the shared HDR target (WebGL2 multisample).
    const rt = new THREE.WebGLRenderTarget(
      Math.round(size.x * pr),
      Math.round(size.y * pr),
      { type: THREE.HalfFloatType, samples: POSTFX.samples },
    );
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x * pr, size.y * pr),
      POSTFX.bloom.strength,
      POSTFX.bloom.radius,
      POSTFX.bloom.threshold,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    // Size every pass to the current drawing buffer (pixel-ratio aware).
    this.composer.setSize(size.x, size.y);
  }

  /** Resize all passes — call alongside renderer.setSize. */
  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  /**
   * Render the frame through the chain.
   * @param dt            frame delta (s) — pass timer + aberration easing
   * @param speedFactor   kart speed / KART.maxSpeed (may exceed 1 on boost)
   * @param reducedMotion kills the speed-linked chromatic edge entirely
   */
  render(dt: number, speedFactor: number, reducedMotion: boolean): void {
    const s = POSTFX.speedFx;
    const ramp = reducedMotion
      ? 0
      : THREE.MathUtils.clamp((speedFactor - s.start) / (1 - s.start), 0, 1);
    const target = s.aberration * ramp;
    // Ease toward target so the effect doesn't pop on/off at the threshold.
    this.aberration += (target - this.aberration) * Math.min(1, dt * s.ease);
    if (Math.abs(this.aberration - target) < 1e-5) this.aberration = target;
    this.grade.uniforms.uAberration.value = this.aberration;
    this.composer.render(dt);
  }
}
