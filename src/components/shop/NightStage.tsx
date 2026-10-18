'use client';
import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { NIGHT_DARK, NIGHT_LIT, TORCH_RAD, coverScale, driftAt, timelineFor, type Crop, type NightHeroEntry } from '@/lib/night-hero';
import { FRAGMENT, VERTEX } from '@/lib/night-hero-shader';

/** Session flag: the sequence plays once per visit; later views start lit. */
const PLAYED_KEY = 'nh-night-played';
/** After this long without the pointer, the torch wanders on its own. */
const IDLE_MS = 2200;
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

/**
 * The night hero's live layer (docs/superpowers/specs/2026-10-19-night-hero-design.md): one Three.js plane whose
 * shader stitches the real embroidery into the real cloth under a pointer torch, timed by an anime.js timeline.
 * Both libraries load after mount. The section's poster stays visible until all textures are in, and stays as the
 * whole hero under reduced motion or without WebGL. One rAF loop copies the timeline's state into the uniforms
 * (anime's update callback does not fire on seek), so React never re-renders per frame.
 */
export function NightStage({ entry }: { entry: NightHeroEntry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eyesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const eyes = eyesRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !eyes || !host) return;
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
      const state = { ...(played ? NIGHT_LIT : NIGHT_DARK) };
      const U = {
        uBare: { value: bare },
        uFull: { value: full },
        uOrder: { value: order },
        uRes: { value: new Vector2(1, 1) },
        uLight: { value: new Vector2(0.6, 0.5) },
        uCover: { value: new Vector2(1, 1) },
        uProg: { value: state.prog },
        uAmb: { value: state.amb },
        uTorch: { value: state.torch },
        uRad: { value: state.rad },
        uSeed: { value: 0 },
      };
      const material = new ShaderMaterial({ uniforms: U, vertexShader: VERTEX, fragmentShader: FRAGMENT });
      const geometry = new PlaneGeometry(2, 2);
      const scene = new Scene();
      scene.add(new Mesh(geometry, material));
      const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const size = () => {
        const r = host.getBoundingClientRect();
        if (!r.width || !r.height) return;
        renderer.setSize(r.width, r.height, false);
        U.uRes.value.set(r.width, r.height);
        U.uCover.value.set(...coverScale(r.width / r.height, src.w / src.h));
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

      const lids = eyes.querySelector<HTMLElement | SVGElement>('[data-lids]');
      const pupils = eyes.querySelectorAll<SVGGElement>('[data-pupil]');
      const at = entry.eyes[crop];
      const b = timelineFor(compact);
      let done = played;
      const tl = createTimeline({ autoplay: false, defaults: { ease: 'inOutSine' }, onComplete: () => void (done = true) });
      if (!played) {
        tl.add(eyes, { opacity: [0, 1], duration: b.eyesIn.dur, ease: 'outQuad' }, b.eyesIn.at)
          .add(state, { torch: [0, 1], rad: [NIGHT_DARK.rad, TORCH_RAD], duration: b.torchOn.dur }, b.torchOn.at)
          .add(state, { prog: [0, 1], duration: b.stitch.dur, ease: 'inOutQuad' }, b.stitch.at)
          .add(state, { amb: [NIGHT_DARK.amb, NIGHT_LIT.amb], rad: [TORCH_RAD, NIGHT_LIT.rad], duration: b.lightUp.dur, ease: 'inOutCubic' }, b.lightUp.at)
          .add(eyes, { opacity: [1, 0], duration: b.eyesOut.dur, ease: 'inQuad' }, b.eyesOut.at);
        if (lids) {
          const q = b.blink.dur / 4;
          tl.add(lids, { scaleY: [0.04, 1], duration: b.lidsOpen.dur, ease: 'outBack' }, b.lidsOpen.at)
            .add(lids, { scaleY: [1, 0.06], duration: q, ease: 'inOutQuad' }, b.blink.at)
            .add(lids, { scaleY: [0.06, 1], duration: q, ease: 'inOutQuad' }, b.blink.at + q)
            .add(lids, { scaleY: [1, 0.06], duration: 2 * q, ease: 'inOutQuad' }, b.blink.at + 2 * q);
        }
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
      let raf = 0;
      const draw = (now: number) => {
        if (now - last > IDLE_MS) [tx, ty] = driftAt((now - t0) / 1000);
        px += (tx - px) * 0.09;
        py += (ty - py) * 0.09;
        U.uProg.value = state.prog;
        U.uAmb.value = state.amb;
        U.uTorch.value = state.torch;
        U.uRad.value = state.rad;
        U.uLight.value.set(px, 1 - py);
        U.uSeed.value = (now % 10000) / 10;
        const dx = clamp((px - (at.x + at.w / 2)) * 30, -14, 14), dy = clamp((py - at.y) * 20, -8, 8);
        pupils.forEach((p) => p.setAttribute('transform', `translate(${dx} ${dy})`));
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

  const pos = {
    '--eye-x': `${entry.eyes.tall.x * 100}%`,
    '--eye-y': `${entry.eyes.tall.y * 100}%`,
    '--eye-w': `${entry.eyes.tall.w * 100}%`,
    '--eye-x-md': `${entry.eyes.wide.x * 100}%`,
    '--eye-y-md': `${entry.eyes.wide.y * 100}%`,
    '--eye-w-md': `${entry.eyes.wide.w * 100}%`,
  } as CSSProperties;

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700 ease-out data-[ready]:opacity-100 motion-reduce:hidden"
      />
      <div
        ref={eyesRef}
        aria-hidden="true"
        style={pos}
        className="pointer-events-none absolute left-[var(--eye-x)] top-[var(--eye-y)] w-[var(--eye-w)] opacity-0 mix-blend-screen motion-reduce:hidden md:left-[var(--eye-x-md)] md:top-[var(--eye-y-md)] md:w-[var(--eye-w-md)]"
      >
        {entry.eyesImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img data-lids src={entry.eyesImage} alt="" className="block w-full origin-center" />
        ) : (
          <DrawnEyes />
        )}
      </div>
    </>
  );
}

/** Stand-in panther eyes until a crop of the panther photograph is supplied (NightHeroEntry.eyesImage). */
function DrawnEyes() {
  const id = useId().replace(/:/g, '');
  const eyes = [50, 190];
  return (
    <svg viewBox="0 0 240 80" className="block h-auto w-full overflow-visible" style={{ filter: 'drop-shadow(0 0 10px #C9A64E55) drop-shadow(0 0 30px #C9A64E22)' }}>
      <defs>
        <radialGradient id={`${id}-iris`} cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="#E9CF7A" />
          <stop offset=".45" stopColor="#C9A64E" />
          <stop offset=".85" stopColor="#6E7A30" />
          <stop offset="1" stopColor="#22250F" />
        </radialGradient>
        {eyes.map((cx) => (
          <clipPath key={cx} id={`${id}-c${cx}`}>
            <path d={`M${cx - 46} 40 Q${cx} -2 ${cx + 46} 40 Q${cx} 72 ${cx - 46} 40Z`} />
          </clipPath>
        ))}
      </defs>
      <g data-lids style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}>
        {eyes.map((cx) => (
          <g key={cx} clipPath={`url(#${id}-c${cx})`}>
            <rect x={cx - 50} y={0} width={100} height={80} fill={`url(#${id}-iris)`} />
            <g data-pupil>
              <ellipse cx={cx} cy={40} rx={6} ry={26} fill="#030302" />
              <ellipse cx={cx + 10} cy={30} rx={4} ry={2.6} fill="#FFF6D8" opacity={0.7} />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
