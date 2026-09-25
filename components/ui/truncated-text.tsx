"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function TruncatedText({ text, className }: { text: string; className?: string }) {
  const id = useId();
  const triggerRef = useRef<HTMLParagraphElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!trigger || !tooltip) return;
      const margin = 8;
      const above = trigger.top - tooltip.height - margin;
      setPosition({
        left: Math.max(margin, Math.min(trigger.right - tooltip.width, window.innerWidth - tooltip.width - margin)),
        top: Math.max(margin, Math.min(
          above >= margin ? above : trigger.bottom + margin,
          window.innerHeight - tooltip.height - margin
        )),
      });
    };
    const dismiss = () => setOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", dismiss, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", dismiss, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, text]);

  return (
    <>
      <p
        ref={triggerRef}
        className={`truncate cursor-help ${className ?? ""}`}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {text}
      </p>
      {open && createPortal(
        <div
          ref={tooltipRef}
          id={id}
          role="tooltip"
          style={position}
          className="pointer-events-none fixed z-[1000] w-max max-w-[min(20rem,calc(100vw-16px))] whitespace-normal break-words rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg"
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
}
