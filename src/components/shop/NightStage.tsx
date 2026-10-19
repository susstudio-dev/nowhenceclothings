'use client';
import { useEffect, useRef } from 'react';
import { NIGHT_DARK, NIGHT_LIT, TORCH_RAD, coverScale, driftAt, eyeLight, imageToStage, needleAt, timelineFor, type Crop, type NightHeroEntry } from '@/lib/night-hero';
import { FRAGMENT, VERTEX } from '@/lib/night-hero-shader';

/** Session flag: the sequence plays once per visit; later views start lit. */
const PLAYED_KEY = 'nh-night-played';
/** After this long without the pointer, the torch wanders on its own. */
const IDLE_MS = 2200;
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

/**
 * The night hero's live layer (docs/superpowers/specs/2026-10-19-night-hero-design.md): one Three.js plane whose
 * shader stitches the real embroidery into the real cloth under a pointer torch and draws the panther's eyes in the
 * same light, timed by an anime.js timeline. Both libraries load after mount. The section's poster stays visible
 * until all textures are in, and stays as the whole hero under reduced motion or without WebGL. One rAF loop
 * copies the timeline's state into the uniforms (anime's update callback does not fire on seek), so React never
 * re-renders per frame.
 */
export function NightStage({ entry }: { entry: NightHeroEntry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const [{ LinearFilter, Mesh, NearestFilter, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, TextureLoader, Vector2, WebGLRenderer }, { createTimeline }] =
        await Promise.all([import('three'), import('animejs')]);
      if (disposed) return;
      const compact = window.matchMedia('(max-width: 767px)').matches;
      const crop: Crop = compact ? 'tall' : 'wide';
      const src = entry.crops[crop];
      const at = entry.eyes[crop];

      let renderer: InstanceType<typeof WebGLRenderer>;
      try {
        renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
      } catch {
        return; // no WebGL: the poster is the hero
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2));
      const loader = new TextureLoader();
      const load = (url: string, nearest = false) =>
        loader.loadAsync(url).then((t) => {
          t.minFilter = t.magFilter = nearest ? NearestFilter : LinearFilter;
          t.generateMipmaps = false;
          return t;
        });
      const textures = await Promise.all([load(src.bare), load(src.full), load(src.order, true)]).catch(() => null);
      if (!textures) {
        renderer.dispose();
        return;
      }
      if (disposed) {
        textures.forEach((t) => t.dispose());
        renderer.dispose();
        return;
      }
      const [bare, full, order] = textures;

      let played = false;
      try {
        played = sessionStorage.getItem(PLAYED_KEY) === '1';
        sessionStorage.setItem(PLAYED_KEY, '1');
      } catch {
        /* storage blocked: play */
      }
      // Shader state the timeline animates; eye 0–1 is the eyes' presence, lid 0 closed to 1 open.
      const state = { ...(played ? NIGHT_LIT : NIGHT_DARK), eye: 0, lid: 0 };
      const U = {
        uBare: { value: bare },
        uFull: { value: full },
        uOrder: { value: order },
        uRes: { value: new Vector2(1, 1) },
        uLight: { value: new Vector2(0.6, 0.5) },
        uCover: { value: new Vector2(1, 1) },
        uTexel: { value: new Vector2(1 / src.w, 1 / src.h) },
        uProg: { value: state.prog },
        uAmb: { value: state.amb },
        uTorch: { value: state.torch },
        uRad: { value: state.rad },
        uSeed: { value: 0 },
        uEyeC: { value: new Vector2(at.x, 1 - at.y) },
        uEyeS: { value: at.size },
        uEye: { value: 0 },
        uLid: { value: 0 },
        uLook: { value: new Vector2(0, 0) },
        uDil: { value: 1 },
        uLit: { value: 0 },
      };
      const material = new ShaderMaterial({ uniforms: U, vertexShader: VERTEX, fragmentShader: FRAGMENT });
      const geometry = new PlaneGeometry(2, 2);
      const scene = new Scene();
      scene.add(new Mesh(geometry, material));
      const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

      let aspect = 1;
      const size = () => {
        const r = host.getBoundingClientRect();
        if (!r.width || !r.height) return;
        aspect = r.width / r.height;
        renderer.setSize(r.width, r.height, false);
        U.uRes.value.set(r.width, r.height);
        U.uCover.value.set(...coverScale(aspect, src.w / src.h));
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(host);

      // The torch: eased toward the pointer (or a drag on touch), wandering when idle.
      let tx = 0.62, ty = 0.48, px = tx, py = ty, last = -Infinity;
      const onPointer = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width;
        ty = (e.clientY - r.top) / r.height;
        last = performance.now();
      };
      host.addEventListener('pointermove', onPointer);
      host.addEventListener('pointerdown', onPointer);

      const b = timelineFor(compact);
      let done = played;
      const tl = createTimeline({ autoplay: false, defaults: { ease: 'inOutSine' }, onComplete: () => void (done = true) });
      if (!played) {
        const q = b.blink.dur / 4;
        tl.add(state, { eye: [0, 1], duration: b.eyesIn.dur, ease: 'outQuad' }, b.eyesIn.at)
          .add(state, { lid: [0, 1], duration: b.lidsOpen.dur, ease: 'outCubic' }, b.lidsOpen.at)
          .add(state, { torch: [0, 1], rad: [NIGHT_DARK.rad, TORCH_RAD], duration: b.torchOn.dur }, b.torchOn.at)
          .add(state, { prog: [0, 1], duration: b.stitch.dur, ease: 'inOutSine' }, b.stitch.at)
          .add(state, { amb: [NIGHT_DARK.amb, NIGHT_LIT.amb], rad: [TORCH_RAD, NIGHT_LIT.rad], duration: b.lightUp.dur, ease: 'inOutCubic' }, b.lightUp.at)
          .add(state, { lid: [1, 0.08], duration: q, ease: 'inQuad' }, b.blink.at)
          .add(state, { lid: [0.08, 1], duration: q, ease: 'outQuad' }, b.blink.at + q)
          .add(state, { lid: [1, 0], duration: 2 * q, ease: 'inOutQuad' }, b.blink.at + 2 * q)
          .add(state, { eye: [1, 0], duration: b.eyesOut.dur, ease: 'inQuad' }, b.eyesOut.at);
      }

      // Off screen: stop drawing and hold the sequence where it is.
      let visible = true;
      const io = new IntersectionObserver(([e]) => {
        visible = Boolean(e?.isIntersecting);
        if (done) return;
        if (visible) tl.play();
        else tl.pause();
      });
      io.observe(host);

      const t0 = performance.now();
      let raf = 0, prev = t0, lit = 0, dil = 1, lookX = 0, lookY = 0;
      const draw = (now: number) => {
        const dt = Math.min(0.1, (now - prev) / 1000);
        prev = now;
        // Idle, the light follows the needle while the rosettes are sewn (so they are seen being made), and wanders
        // otherwise. It eases like a hand-held light; the pointer, when it moves, takes over.
        if (now - last > IDLE_MS) {
          const sewing = state.prog > 0 && state.prog < 1;
          [tx, ty] = sewing ? imageToStage(needleAt(state.prog, src.needle), [U.uCover.value.x, U.uCover.value.y]) : driftAt((now - t0) / 1000);
        }
        const ease = now - last > IDLE_MS ? 0.06 : 0.09;
        px += (tx - px) * ease;
        py += (ty - py) * ease;
        // Pupils follow the light and close to slits in it, with an iris's lag (fast to close, slow to open).
        const target = eyeLight(state.torch, state.rad, [px, py], at, aspect);
        lit += (target - lit) * Math.min(1, dt * 6);
        const want = 1 - 0.88 * lit;
        dil += (want - dil) * Math.min(1, dt * (want < dil ? 5 : 1.4));
        lookX += (clamp(((px - at.x) * aspect) / 0.35, -1, 1) - lookX) * Math.min(1, dt * 4);
        lookY += (clamp((at.y - py) / 0.3, -1, 1) - lookY) * Math.min(1, dt * 4);
        U.uProg.value = state.prog;
        U.uAmb.value = state.amb;
        U.uTorch.value = state.torch;
        U.uRad.value = state.rad;
        U.uEye.value = state.eye;
        U.uLid.value = state.lid;
        U.uLit.value = lit;
        U.uDil.value = dil;
        U.uLook.value.set(lookX, lookY);
        U.uLight.value.set(px, 1 - py);
        U.uSeed.value = (now % 10000) / 10;
        renderer.render(scene, camera);
      };
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (visible) draw(now);
      };
      draw(t0);
      canvas.dataset.ready = '';
      if (!played) tl.play();
      raf = requestAnimationFrame(loop);

      cleanup = () => {
        cancelAnimationFrame(raf);
        tl.revert();
        ro.disconnect();
        io.disconnect();
        host.removeEventListener('pointermove', onPointer);
        host.removeEventListener('pointerdown', onPointer);
        textures.forEach((t) => t.dispose());
        material.dispose();
        geometry.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [entry]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700 ease-out data-[ready]:opacity-100 motion-reduce:hidden"
    />
  );
}
