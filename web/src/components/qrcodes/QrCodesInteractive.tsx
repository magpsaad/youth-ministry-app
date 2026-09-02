"use client";

import { useState, useTransition } from "react";
import type { QrCodeForPrinting } from "@/lib/qrcodes";
import { markPrintedAction } from "@/app/qr-codes/actions";

function contrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#FFFFFF";
}

/** REQUIREMENTS.md §6.15 -- print-optimized layout for every current QR
 * code, real scannable images generated on the fly (no external service).
 * Colored frame/label matches the old app's actual look (colors sampled
 * directly from its real QR image files, not guessed). "Needs Reprint"
 * flags whenever a code's label/state has changed since it was last
 * marked printed. */
export function QrCodesInteractive({ qrCodes: initial }: { qrCodes: QrCodeForPrinting[] }) {
  const [qrCodes, setQrCodes] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleMarkPrinted(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await markPrintedAction(id);
      setPendingId(null);
      if (result.error) {
        alert(result.error);
        return;
      }
      setQrCodes((prev) => prev.map((q) => (q.id === id ? { ...q, needsReprint: false } : q)));
    });
  }

  return (
    <div>
      <div className="print:hidden flex justify-end mb-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45] shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
        >
          Print All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-1 print:gap-0">
        {qrCodes.map((q) => {
          const textColor = contrastText(q.color);
          return (
            <div
              key={q.id}
              // print:min-h-screen used to sit here to vertically-center each
              // code on its own printed page, but `vh` units don't map
              // reliably to an actual printed page's height (a well-known
              // print-CSS pitfall) -- it was overflowing onto a stray extra
              // page for some codes. print:break-after-page alone already
              // guarantees "one code per page" without it. That same class
              // was also unconditionally on the LAST code too, forcing a
              // guaranteed blank page after it -- print:last:break-after-auto
              // undoes it for just that one (owner-reported: both a stray
              // blank page mid-list and one at the very end).
              className="flex flex-col items-center print:break-inside-avoid print:break-after-page print:last:break-after-auto print:pt-12"
            >
              <div className="rounded-3xl p-3 print:p-6" style={{ backgroundColor: q.color }}>
                <div
                  className="rounded-2xl bg-white p-3 w-[220px] print:w-[420px] [&_svg]:h-auto [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: q.svg }}
                />
              </div>
              <div
                className="-mt-4 rounded-full px-6 py-2 text-center font-bold shadow-[0_2px_6px_rgba(0,0,0,0.15)] print:px-10 print:py-4 print:text-2xl"
                style={{ backgroundColor: q.color, color: textColor }}
              >
                {q.label}
              </div>
              {q.needsReprint && (
                <span className="print:hidden mt-2 rounded-full bg-[#fff3cd] text-[#856404] text-[11px] font-semibold px-2 py-0.5">
                  Needs Reprint
                </span>
              )}
              <button
                type="button"
                onClick={() => handleMarkPrinted(q.id)}
                disabled={pendingId === q.id}
                className="print:hidden mt-2 rounded-md bg-[#f0f0f0] px-3 py-1.5 text-xs font-semibold text-[#333] hover:bg-[#e0e0e0] disabled:opacity-60"
              >
                {pendingId === q.id ? "Marking…" : "Mark as Printed"}
              </button>
            </div>
          );
        })}
        {qrCodes.length === 0 && <p className="text-sm text-[#666] col-span-full text-center py-8">No QR codes yet.</p>}
      </div>
    </div>
  );
}
