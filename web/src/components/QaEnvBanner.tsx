"use client";

import { useEffect, useRef } from "react";
import { AlertTriangleIcon } from "@/components/icons";

/**
 * Owner-requested: every page header in the app is sticky now (GroupNavShell
 * and every standalone page's own header), and each needs to sit directly
 * below this banner while scrolling, not underneath/overlapping it. Sibling
 * `position: sticky` elements don't stack on their own -- the header below
 * needs an explicit `top` offset equal to this banner's rendered height.
 * That height isn't fixed (the text can wrap to two lines on a narrow
 * phone), so it's measured live via ResizeObserver and published as the
 * `--qa-banner-h` CSS variable on the root element; every sticky header
 * below reads that variable for its own `top` (see globals.css, which
 * defaults it to 0px -- what every header resolves to on prod, where this
 * component never renders at all).
 */
export function QaEnvBanner() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty("--qa-banner-h", `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty("--qa-banner-h", "0px");
    };
  }, []);

  return (
    <div
      ref={ref}
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-[#ff6a00] px-4 py-2.5 text-center shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
    >
      <AlertTriangleIcon className="h-5 w-5 shrink-0 text-white" />
      <p className="text-sm sm:text-lg font-extrabold uppercase tracking-wide text-white">
        QA Testing Environment — Not the Real App
      </p>
    </div>
  );
}
