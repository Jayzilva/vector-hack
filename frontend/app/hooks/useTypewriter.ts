"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Typewriter hook that gradually reveals text.
 * When `fullText` changes, it animates from current length to full length.
 * Set `enabled` to false to skip animation and show text instantly.
 */
export function useTypewriter(
  fullText: string,
  enabled: boolean,
  charsPerTick = 8,
  intervalMs = 12,
): string {
  const [displayed, setDisplayed] = useState(enabled ? "" : fullText);
  const prevTextRef = useRef(fullText);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // If disabled, always show full text immediately
    if (!enabled) {
      setDisplayed(fullText);
      prevTextRef.current = fullText;
      return;
    }

    // If text was cleared (new message), reset
    if (!fullText) {
      setDisplayed("");
      prevTextRef.current = "";
      return;
    }

    // Text arrived or changed — start typing from where we left off
    const startFrom = displayed.length;
    const target = fullText;

    if (startFrom >= target.length) {
      // Already fully displayed
      prevTextRef.current = fullText;
      return;
    }

    let current = startFrom;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      current = Math.min(current + charsPerTick, target.length);
      setDisplayed(target.slice(0, current));

      if (current >= target.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, intervalMs);

    prevTextRef.current = fullText;

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, enabled]);

  return displayed;
}
