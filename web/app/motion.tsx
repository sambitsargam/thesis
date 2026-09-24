"use client";

import {type ReactNode, useEffect, useRef, useState} from "react";

const EASE_OUT_EXPO = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Counts from the previous value to the next one on every change.
 *
 * Financial figures read better when they move: a share count that ticks up
 * after a mint tells the viewer something happened without a page reload.
 * Respects `prefers-reduced-motion` by snapping instead.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 900,
  prefix = "",
  suffix = ""
}: {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    if (prefersReducedMotion()) {
      fromRef.current = value;
      setShown(value);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setShown(from + (value - from) * EASE_OUT_EXPO(progress));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return (
    <span className="tnum">
      {prefix}
      {shown.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}
      {suffix}
    </span>
  );
}

/**
 * Fades and lifts children into place, staggered by index.
 *
 * Content must never stay hidden: if IntersectionObserver is missing, or an
 * observer never fires (above-the-fold elements on some mobile browsers report
 * no intersection), a timer reveals the content anyway. A missed animation is a
 * cosmetic loss; an invisible page is not.
 */
export function Reveal({
  children,
  delay = 0,
  className = ""
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    // Belt and braces: reveal regardless once this fires.
    const failsafe = setTimeout(() => setShown(true), 700 + delay);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      {rootMargin: "0px 0px -40px 0px"}
    );

    observer.observe(node);
    return () => {
      clearTimeout(failsafe);
      observer.disconnect();
    };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? "in" : ""} ${className}`}
      style={{transitionDelay: `${delay}ms`}}
    >
      {children}
    </div>
  );
}

/** Grows a bar to `percent` once it is on screen. */
export function Bar({percent, delay = 0}: {percent: number; delay?: number}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(percent), 60 + delay);
    return () => clearTimeout(timer);
  }, [percent, delay]);

  return (
    <div className="bar">
      <i style={{width: `${width}%`}} />
    </div>
  );
}

/** Briefly highlights its children whenever `watch` changes. */
export function Flash({watch, children}: {watch: string | number; children: ReactNode}) {
  const [on, setOn] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setOn(true);
    const timer = setTimeout(() => setOn(false), 1100);
    return () => clearTimeout(timer);
  }, [watch]);

  return <span className={on ? "flash on" : "flash"}>{children}</span>;
}
