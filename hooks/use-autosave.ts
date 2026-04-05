"use client";

import { useEffect, useRef } from "react";

export function useAutosave(callback: () => void, enabled: boolean, delay = 1200) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(callback, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [callback, delay, enabled]);
}
