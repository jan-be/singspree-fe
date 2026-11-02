import React, { useLayoutEffect, useRef } from 'react';
import { MAX_SCORE, MAX_STARS, starFill, starsFor } from '../logic/scoreScale';

/** A five-pointed star in a 24×24 box: x 1.54–22.46, and the round stroke adds 0.8 around it. */
const STAR_PATH = 'M12 1.5L14.94 8.45L22.46 9.1L16.76 14.05L18.47 21.4L12 17.5L5.53 21.4L7.24 14.05L1.54 9.1L9.06 8.45Z';
// Where the star starts and ends in its box (percent of the width), for the fill level
const LEFT = (0.74 / 24) * 100, RIGHT = (23.26 / 24) * 100;

/**
 * The clip that shows the left `fill` (0–1) of a star: it fills from left to
 * right, so the five read like one progress bar.
 */
function clipFor(fill: number): string {
  return fill >= 1 ? 'none' : `inset(0 ${(100 - LEFT - fill * (RIGHT - LEFT)).toFixed(1)}% 0 0)`;
}

/** Plays a CSS animation class again from its start. */
function replay(el: Element, cls: string) {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth; // (a reflow, once per star earned)
  el.classList.add(cls);
}

const shown = new WeakMap<HTMLElement, number>(); // meter -> the score it shows

/**
 * Shows `score` on a meter (StarMeter's element): every star filled up to
 * its share, a star that just got full pops (`celebrate`), and all five
 * wave when the last one does. Writes only what changed, so the score strip
 * calls it with every batch of notes, outside React.
 */
export function paintStars(meter: HTMLElement, score: number, celebrate = true): void {
  const before = shown.get(meter);
  if (before === score) return;
  shown.set(meter, score);
  const party = celebrate && before !== undefined; // (a meter's first paint is no news)
  for (let i = 0; i < MAX_STARS; i++) {
    const star = meter.children[i];
    const fill = starFill(score, i), was = before === undefined ? -1 : starFill(before, i);
    const clip = clipFor(fill);
    if (was < 0 || clip !== clipFor(was)) {
      const level = star.firstElementChild!.lastElementChild as SVGElement;
      level.style.clipPath = clip;
      level.style.setProperty('-webkit-clip-path', clip);
    }
    const earned = fill >= 1;
    if (earned !== (was >= 1)) {
      star.classList.toggle('is-earned', earned);
      if (earned && party) replay(star, 'is-popping');
    }
  }
  const stars = starsFor(score);
  if (before === undefined || stars !== starsFor(before)) {
    meter.setAttribute('aria-label', `${stars}/${MAX_STARS}`);
    meter.classList.toggle('is-full', stars === MAX_STARS);
    if (stars === MAX_STARS && party) replay(meter, 'is-waving');
  }
}

export interface StarMeterProps {
  /** the score to show; between renders, paintStars on `meterRef`'s element shows newer ones */
  score: number;
  /** a star's size in px; without one, the font size `className` gives */
  size?: number;
  /** 'chip': over the playing video, so no filters; 'card': the score screen, glowing */
  look?: 'chip' | 'card';
  className?: string;
  /** the meter's element, for paintStars */
  meterRef?: (el: HTMLSpanElement | null) => void;
}

/**
 * The five stars of a score, filling from left to right as the points come
 * in, like one progress bar (logic/scoreScale.ts: star i fills between
 * threshold i-1 and i). A star that fills up pops with a ring and sparks;
 * index.css has the looks.
 */
const StarMeter = ({ score, size, look = 'chip', className = '', meterRef }: StarMeterProps) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const painted = useRef(false);
  useLayoutEffect(() => {
    if (ref.current) paintStars(ref.current, score, painted.current);
    painted.current = true;
  }, [score]);
  return (
    <span
      ref={el => { ref.current = el; meterRef?.(el); }}
      role="img"
      aria-label={`0/${MAX_STARS}`}
      className={`star-meter star-meter--${look} ${className}`}
      style={size ? { fontSize: size } : undefined}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <span key={i} className="star-meter__star" style={{ '--i': i } as React.CSSProperties}>
          <span className="star-meter__body">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="star-meter__base"><path d={STAR_PATH} /></svg>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="star-meter__fill" style={{ clipPath: clipFor(0) }}><path d={STAR_PATH} /></svg>
          </span>
        </span>
      ))}
    </span>
  );
};

export default React.memo(StarMeter);

/** How long the score screen counts a score up: longer for more points, under two seconds. */
export function revealMs(score: number): number {
  return Math.round(600 + 1400 * Math.min(1, Math.max(0, score) / MAX_SCORE));
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t); // = cubic-bezier(0.5, 1, 0.89, 1), the bar's (.animate-grow-x)

export interface ScoreRevealProps {
  score: number;
  /** ms before counting starts */
  delay?: number;
  /** a star's size in px */
  size?: number;
  /** the number's classes */
  className?: string;
}

/**
 * A score on the score screen: the number counts up from 0 while the stars
 * under it fill, and each one pops as the count passes its threshold.
 * Reduced motion: the final score at once. A later score counts on from the
 * one shown.
 */
export const ScoreReveal = ({ score, delay = 0, size = 18, className = '' }: ScoreRevealProps) => {
  const numberRef = useRef<HTMLSpanElement | null>(null);
  const meterRef = useRef<HTMLSpanElement | null>(null);
  const shownRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    const number = numberRef.current, meter = meterRef.current;
    if (!number || !meter) return;
    const show = (value: number) => {
      shownRef.current = value;
      number.textContent = Math.round(value).toLocaleString();
      paintStars(meter, value);
    };
    const from = shownRef.current ?? 0;
    if (from === score || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { show(score); return; }
    show(from);
    const start = performance.now() + (from === 0 ? delay : 0);
    const duration = revealMs(score - from);
    let raf = requestAnimationFrame(function step(now) {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      show(from + (score - from) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [score, delay]);
  return (
    <>
      <div className={className}><span ref={numberRef} /></div>
      <StarMeter score={0} size={size} look="card" meterRef={el => { meterRef.current = el; }} />
    </>
  );
};
