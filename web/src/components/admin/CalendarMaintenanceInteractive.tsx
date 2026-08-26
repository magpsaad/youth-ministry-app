"use client";

import { useMemo, useState, useTransition } from "react";
import { computeHolidaysForYear } from "@/lib/holidays";
import { preloadHolidaysAction } from "@/app/admin/calendar-maintenance/actions";

export function CalendarMaintenanceInteractive({ defaultYear }: { defaultYear: number }) {
  const [year, setYear] = useState(defaultYear);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => computeHolidaysForYear(year), [year]);

  function handlePreload() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await preloadHolidaysAction(year);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResult({ inserted: res.inserted, skipped: res.skipped });
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-3">Preload Holidays &amp; Feast Days</h2>
        <p className="text-sm text-[#666] mb-3">
          Computes a standard Coptic Orthodox liturgical set for the selected year (fixed feasts plus Pascha-relative
          movable feasts, calculated algorithmically). Review the preview below before adding it to the calendar.
        </p>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-[#333]">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-28 rounded-md border border-[#ddd] px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
          />
          <button
            type="button"
            onClick={handlePreload}
            disabled={pending}
            className="rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
          >
            {pending ? "Adding…" : `Add ${year} Holidays to Calendar`}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-[#dc3545]">{error}</p>}
        {result && (
          <p className="mt-3 text-sm text-[#155724]">
            Added {result.inserted} new holiday{result.inserted === 1 ? "" : "s"}
            {result.skipped > 0 ? ` (${result.skipped} already existed and were skipped).` : "."}
          </p>
        )}
      </div>

      <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">Preview for {year}</h3>
        <div className="divide-y divide-[#f0f0f0]">
          {preview.map((h) => (
            <div key={h.title} className="py-2 flex items-center justify-between text-sm">
              <span className="text-[#333]">{h.title}</span>
              <span className="text-[#666]">{h.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
