'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DURATION_MS,
  ID,
  LOUPE_ID,
  PIECES,
  TIMELINE,
  buildScene,
  frame,
  glintTransform,
  loupeCamera,
  sceneMarkup,
  seamPath,
  viewBoxFor,
  type Frame,
  type Motif,
  type Scene,
} from '@/lib/stitch-hero';

/** Session flag: the stitch plays once per visit, later views rest on the finished polo. */
const PLAYED_KEY = 'nh-stitch-played';

type Start = { compact: boolean; finished: boolean; reduced: boolean };
type Listener = (t: number) => void;
interface Clock {
  scene: Scene;
  start: Start;
  dur: number;
  subscribe(fn: Listener): () => void;
}
const ClockContext = createContext<Clock | null>(null);

/**
 * One clock for the home stitch hero, shared by the stage and the loupe so they stay in step. Built on the
 * client from `lib/stitch-hero` (no HTML weight on the server render); one rAF loop, views write attributes,
 * React never re-renders per frame. Children render on the server (the caption) and pass through.
 */
export function StitchScene({ motif, children }: { motif: Motif; children: ReactNode }) {
  const [start, setStart] = useState<Start | null>(null);
  const listeners = useRef(new Set<Listener>());
  const current = useRef(0);

  useEffect(() => {
    let played = false;
    try {
      played = sessionStorage.getItem(PLAYED_KEY) === '1';
    } catch {
      /* storage blocked: play */
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setStart({ compact: window.matchMedia('(max-width: 767px)').matches, finished: played || reduced, reduced });
  }, []);

  const clock = useMemo<Clock | null>(() => {
    if (!start) return null;
    current.current = start.finished ? 1 : 0;
    return {
      scene: buildScene(motif),
      start,
      dur: start.compact ? DURATION_MS.compact : DURATION_MS.wide,
      subscribe(fn) {
        listeners.current.add(fn);
        fn(current.current);
        return () => void listeners.current.delete(fn);
      },
    };
  }, [motif, start]);

  // Views subscribe in their own effects, which run before this one.
  useEffect(() => {
    if (!clock || clock.start.finished) return;
    const emit = (t: number) => {
      current.current = t;
      listeners.current.forEach((fn) => fn(t));
    };
    let raf = 0;
    let prev = performance.now();
    let elapsed = 0;
    const loop = (now: number) => {
      // Capped step: a backgrounded tab resumes where it stopped instead of jumping to the end; slow
      // devices (down to 4 fps) still finish on time.
      elapsed += Math.min(now - prev, 250);
      prev = now;
      const t = Math.min(1, elapsed / clock.dur);
      emit(t);
      if (t < 1) raf = requestAnimationFrame(loop);
      else
        try {
          sessionStorage.setItem(PLAYED_KEY, '1');
        } catch {
          /* storage blocked: it plays again next time */
        }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [clock]);

  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

const aspectOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r.width / r.height : 6 / 7;
};

/** Writes a frame into one copy of the scene's SVG, touching only what changed. */
function painter(svg: SVGSVGElement, scene: Scene, prefix: string) {
  const q = <T extends Element>(id: string) => svg.querySelector<T>(`#${prefix}-${id}`)!;
  const pieces = PIECES.map((p) => {
    const el = q<SVGGElement>(`pc-${p.id}`);
    return { el, drop: el.querySelector<SVGPathElement>('.st-drop')! };
  });
  const draft = q<SVGGElement>('draft');
  const seams = scene.seams.map((_, i) => [q<SVGPathElement>(`sv${i}`), q<SVGPathElement>(`s${i}`)]);
  const buttons = [0, 1].map((i) => q<SVGGElement>(`bt${i}`));
  const els = scene.els.map((_, i) => q<SVGGElement>(`e${i}`));
  const needles = [0, 1].map((i) => q<SVGGElement>(`nd${i}`));
  const glint = q<SVGLinearGradientElement>('glint');
  const last = { vb: '', pieces: pieces.map(() => ''), draft: -1, seams: seams.map(() => -1), buttons: [-1, -1], els: els.map(() => -1), glint: 0 };

  return (f: Frame, needle: boolean) => {
    if (f.viewBox !== last.vb) svg.setAttribute('viewBox', (last.vb = f.viewBox));
    f.pieces.forEach((p, i) => {
      const key = p.transform + p.opacity + p.drop;
      if (key === last.pieces[i]) return;
      last.pieces[i] = key;
      const { el, drop } = pieces[i]!;
      if (p.transform) el.setAttribute('transform', p.transform);
      else el.removeAttribute('transform');
      el.style.opacity = String(p.opacity);
      drop.setAttribute('transform', p.drop);
      drop.style.opacity = String(p.dropOpacity);
    });
    if (f.draftOpacity !== last.draft) draft.style.opacity = String((last.draft = f.draftOpacity));
    f.seams.forEach((p, i) => {
      if (p === last.seams[i]) return;
      last.seams[i] = p;
      const d = seamPath(scene.seams[i]!, p);
      for (const el of seams[i]!) el.setAttribute('d', d);
    });
    if (f.glint !== last.glint) glint.setAttribute('gradientTransform', glintTransform((last.glint = f.glint)));
    f.buttons.forEach((s, i) => {
      if (s === last.buttons[i]) return;
      last.buttons[i] = s;
      buttons[i]!.setAttribute('transform', `translate(300 ${i ? 190 : 146}) scale(${s.toFixed(3)})`);
    });
    f.els.forEach((p, i) => {
      if (p === last.els[i]) return;
      last.els[i] = p;
      const e = scene.els[i]!;
      const el = els[i]!;
      if (e.kind === 'satin') {
        el.style.strokeDashoffset = (1000 * (1 - p)).toFixed(1);
        el.style.opacity = p > 0 ? '1' : '0';
      } else el.setAttribute('transform', `translate(${e.cx.toFixed(1)} ${e.cy.toFixed(1)}) scale(${p.toFixed(3)})`);
    });
    needles.forEach((el, i) => {
      const tip = needle ? f.tips[i] : undefined;
      if (!tip) {
        el.style.opacity = '0';
        return;
      }
      // The needle keeps one size on screen however close the camera is, and bobs as it stitches.
      const s = f.needleScale;
      el.style.opacity = '1';
      el.setAttribute('transform', `translate(${(tip.x + 0.325 * tip.lift * s).toFixed(1)} ${(tip.y - 0.95 * tip.lift * s).toFixed(1)}) scale(${s.toFixed(3)})`);
    });
  };
}

function StitchView({ prefix, loupe = false }: { prefix: string; loupe?: boolean }) {
  const clock = useContext(ClockContext);
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<SVGSVGElement>(null);
  const markup = useMemo(() => (clock ? sceneMarkup(clock.scene, prefix) : ''), [clock, prefix]);

  useEffect(() => {
    const svg = ref.current;
    const stage = box.current;
    if (!clock || !svg || !stage) return;
    const { scene, start, dur } = clock;
    const paint = painter(svg, scene, prefix);
    let aspect = aspectOf(stage);
    let t = 0;
    // The loupe's drift along the finished embroidery, in seconds since the stitching ended.
    let drift = 0;
    const draw = () => paint(frame(scene, t, start.compact, aspect, loupe ? loupeCamera(scene, t, drift) : undefined), !start.finished && t < 1);

    // After the polo is finished the loupe keeps drifting, only while it can be seen.
    let raf = 0;
    let seen = true;
    let prev = 0;
    const tick = (now: number) => {
      drift += Math.min(now - prev, 100) / 1000;
      prev = now;
      svg.setAttribute('viewBox', viewBoxFor(loupeCamera(scene, 1, drift), aspect));
      raf = requestAnimationFrame(tick);
    };
    const drifting = () => loupe && !start.reduced && t >= 1;
    const resume = () => {
      if (raf || !seen || !drifting()) return;
      prev = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const pause = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const unsubscribe = clock.subscribe((next) => {
      t = next;
      if (loupe) drift = Math.max(0, ((t - TIMELINE.emb[1]) * dur) / 1000);
      draw();
      if (t >= 1) resume();
    });
    // The box changes shape with the viewport; reframe without restarting.
    const ro = new ResizeObserver(() => {
      aspect = aspectOf(stage);
      if (!raf) draw();
    });
    ro.observe(stage);
    const io = loupe
      ? new IntersectionObserver(([entry]) => {
          seen = entry!.isIntersecting;
          if (seen) resume();
          else pause();
        })
      : undefined;
    io?.observe(stage);
    return () => {
      unsubscribe();
      pause();
      ro.disconnect();
      io?.disconnect();
    };
  }, [clock, prefix, loupe]);

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      {clock && (
        <svg
          ref={ref}
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
          className="stitch-svg block h-full w-full"
          // Generated from numbers only (lib/stitch-hero); no product text reaches this markup.
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      )}
    </div>
  );
}

/** The drawn polo: close on the needle, then the pull back as the pieces gather and are sewn. */
export function StitchStage() {
  return <StitchView prefix={ID} />;
}

/** A magnified window on the embroidery: follows the needle, then drifts along the finished stitches. */
export function StitchLoupe() {
  return <StitchView prefix={LOUPE_ID} loupe />;
}
