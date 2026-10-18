'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DURATION_MS, ID, PIECES, buildScene, frame, sceneMarkup, seamPath, type Motif } from '@/lib/stitch-hero';

/** Session flag: the stitch plays once per visit, later views rest on the finished polo. */
const PLAYED_KEY = 'nh-stitch-played';

type Start = { compact: boolean; finished: boolean };

const aspectOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r.width / r.height : 6 / 7;
};

/**
 * The drawn polo of the home stitch hero. Built on the client from `lib/stitch-hero` (no HTML weight on the
 * server render), then one rAF loop writes attributes; React never re-renders per frame. Decorative: the
 * caption beside it carries the product.
 */
export function StitchStage({ motif }: { motif: Motif }) {
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<SVGSVGElement>(null);
  const [start, setStart] = useState<Start | null>(null);

  useEffect(() => {
    let played = false;
    try {
      played = sessionStorage.getItem(PLAYED_KEY) === '1';
    } catch {
      /* storage blocked: play */
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setStart({ compact: window.matchMedia('(max-width: 767px)').matches, finished: played || reduced });
  }, []);

  const scene = useMemo(() => (start ? buildScene(motif) : null), [motif, start]);
  const markup = useMemo(() => (scene ? sceneMarkup(scene) : ''), [scene]);
  const initialViewBox = useMemo(
    () => (scene && start && box.current ? frame(scene, start.finished ? 1 : 0, start.compact, aspectOf(box.current)).viewBox : '0 0 600 700'),
    [scene, start],
  );

  useEffect(() => {
    const svg = ref.current;
    const stage = box.current;
    if (!svg || !stage || !scene || !start) return;
    let aspect = aspectOf(stage);
    let current = start.finished ? 1 : 0;
    const q = <T extends Element>(id: string) => svg.querySelector<T>(`#${ID}-${id}`)!;
    const pieces = PIECES.map((p) => {
      const el = q<SVGGElement>(`pc-${p.id}`);
      return { el, drop: el.querySelector<SVGPathElement>('.st-drop')! };
    });
    const draft = q<SVGGElement>('draft');
    const seams = scene.seams.map((_, i) => q<SVGPathElement>(`s${i}`));
    const buttons = [0, 1].map((i) => q<SVGGElement>(`bt${i}`));
    const els = scene.els.map((_, i) => q<SVGGElement>(`e${i}`));
    const needles = [0, 1].map((i) => q<SVGGElement>(`nd${i}`));
    const last = { vb: '', pieces: pieces.map(() => ''), draft: -1, seams: seams.map(() => -1), buttons: [-1, -1], els: els.map(() => -1) };

    const paint = (t: number, needle: boolean) => {
      current = t;
      const f = frame(scene, t, start.compact, aspect);
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
        seams[i]!.setAttribute('d', seamPath(scene.seams[i]!, p));
      });
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

    // The stage box changes shape with the viewport; reframe without restarting.
    const ro = new ResizeObserver(() => {
      aspect = aspectOf(stage);
      paint(current, current < 1);
    });
    ro.observe(stage);
    if (start.finished) {
      paint(1, false);
      return () => ro.disconnect();
    }
    paint(0, true);
    const dur = start.compact ? DURATION_MS.compact : DURATION_MS.wide;
    let raf = 0;
    let prev = performance.now();
    let elapsed = 0;
    const loop = (now: number) => {
      // Capped step: a backgrounded tab resumes where it stopped instead of jumping to the end; slow
      // devices (down to 4 fps) still finish on time.
      elapsed += Math.min(now - prev, 250);
      prev = now;
      const t = Math.min(1, elapsed / dur);
      paint(t, true);
      if (t < 1) raf = requestAnimationFrame(loop);
      else
        try {
          sessionStorage.setItem(PLAYED_KEY, '1');
        } catch {
          /* storage blocked: it plays again next time */
        }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [scene, start]);

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      {start && (
        <svg
          ref={ref}
          aria-hidden="true"
          focusable="false"
          viewBox={initialViewBox}
          preserveAspectRatio="xMidYMid meet"
          className="stitch-svg block h-full w-full"
          // Generated from numbers only (lib/stitch-hero); no product text reaches this markup.
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      )}
    </div>
  );
}
