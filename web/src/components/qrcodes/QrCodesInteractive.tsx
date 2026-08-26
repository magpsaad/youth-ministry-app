"use client";

import { useState, useTransition } from "react";
import type { QrCodeForPrinting } from "@/lib/qrcodes";
import { markPrintedAction } from "@/app/qr-codes/actions";

/** REQUIREMENTS.md §6.15 -- print-optimized layout for every current QR
 * code, real scannable images generated on the fly (no external service).
 * "Needs Reprint" flags whenever a code's label has changed (e.g. a
 * future Group Transition rename) since it was last marked printed. */
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
          className="rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45]"
        >
          Print All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-6">
        {qrCodes.map((q) => (
          <div
            key={q.id}
            className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4 flex flex-col items-center text-center print:shadow-none print:border print:border-[#ccc] print:break-inside-avoid"
          >
            <div className="[&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-[180px]" dangerouslySetInnerHTML={{ __html: q.svg }} />
            <p className="mt-2 font-semibold text-[#1e3a5f]">{q.label}</p>
            {q.needsReprint && (
              <span className="print:hidden mt-1 rounded-full bg-[#fff3cd] text-[#856404] text-[11px] font-semibold px-2 py-0.5">
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
        ))}
        {qrCodes.length === 0 && <p className="text-sm text-[#666] col-span-full text-center py-8">No QR codes yet.</p>}
      </div>
    </div>
  );
}
