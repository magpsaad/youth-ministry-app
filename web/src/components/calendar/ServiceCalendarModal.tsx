"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CalendarEvent } from "@/lib/calendar-types";
import { EVENT_TYPE_COLORS } from "@/lib/calendar-types";
import { EventForm } from "./EventForm";

type View = "month" | "week" | "list" | "fridays";

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function monthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Whether any day in the event's [start_date, end_date] range falls on the
 * given ISO weekday (1=Monday .. 7=Sunday). */
function matchesWeekday(e: CalendarEvent, isoWeekday: number): boolean {
  const start = new Date(`${e.start_date}T00:00:00`);
  const end = new Date(`${e.end_date}T00:00:00`);
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    if (dow === isoWeekday) return true;
  }
  return false;
}

function EventPill({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const colors = EVENT_TYPE_COLORS[event.event_type];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: colors.bg, color: colors.color }}
      title={event.title}
    >
      {event.title}
    </button>
  );
}

function DayGrid({
  days,
  currentMonth,
  eventsForDate,
  onDayClick,
  onEventClick,
}: {
  days: Date[];
  currentMonth?: number;
  eventsForDate: (dateISO: string) => CalendarEvent[];
  onDayClick: (dateISO: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const todayISO = toISO(new Date());
  return (
    <div className="grid grid-cols-7 gap-px bg-[#e0e0e0] rounded-lg overflow-hidden border border-[#e0e0e0]">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
        <div key={d} className="bg-[#f5f5f5] px-2 py-1.5 text-center text-xs font-semibold text-[#666]">
          {d}
        </div>
      ))}
      {days.map((day) => {
        const dateISO = toISO(day);
        const dimmed = currentMonth !== undefined && day.getMonth() !== currentMonth;
        const events = eventsForDate(dateISO);
        return (
          <div
            key={dateISO}
            onClick={() => onDayClick(dateISO)}
            className={`min-h-[90px] bg-white p-1.5 cursor-pointer hover:bg-[#f9f9f9] ${dimmed ? "opacity-40" : ""}`}
          >
            <span
              className={`text-xs font-semibold ${
                dateISO === todayISO ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a5f] text-white" : "text-[#333]"
              }`}
            >
              {day.getDate()}
            </span>
            <div className="mt-1 space-y-0.5">
              {events.map((e) => (
                <EventPill key={e.id} event={e} onClick={() => onEventClick(e)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ events, onEventClick }: { events: CalendarEvent[]; onEventClick: (e: CalendarEvent) => void }) {
  const sorted = [...events].sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (sorted.length === 0) {
    return <p className="text-center text-sm text-[#666] py-8">No events to show.</p>;
  }
  return (
    <div className="space-y-2">
      {sorted.map((e) => {
        const colors = EVENT_TYPE_COLORS[e.event_type];
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onEventClick(e)}
            className="w-full text-left rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-3 flex items-center gap-3 hover:shadow-[0_4px_15px_rgba(0,0,0,0.12)] transition-shadow"
          >
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0" style={{ backgroundColor: colors.bg, color: colors.color }}>
              {e.event_type}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#1e3a5f] truncate">{e.title}</p>
              <p className="text-xs text-[#666]">
                {e.start_date}
                {e.end_date !== e.start_date ? ` – ${e.end_date}` : ""}
                {e.location ? ` · ${e.location}` : ""}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** REQUIREMENTS.md §6.8 -- fullscreen modal, 4 views (Month/Week/List/the
 * deployment's actual service-day view). Event creation/editing/deletion is
 * open to all Servants (RLS enforces this regardless of the UI). */
export function ServiceCalendarModal({
  events,
  serviceWeekdayLabel,
  serviceWeekday,
  onClose,
  onRefresh,
}: {
  events: CalendarEvent[];
  serviceWeekdayLabel: string;
  serviceWeekday: number;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | "new" | null>(null);
  const [newEventDate, setNewEventDate] = useState<string | undefined>(undefined);

  const eventsForDate = useMemo(() => {
    return (dateISO: string) => events.filter((e) => dateISO >= e.start_date && dateISO <= e.end_date);
  }, [events]);

  function openNew(dateISO?: string) {
    setNewEventDate(dateISO);
    setEditingEvent("new");
  }

  function navigate(direction: -1 | 1) {
    setCursor((c) => (view === "week" ? addDays(c, 7 * direction) : new Date(c.getFullYear(), c.getMonth() + direction, 1)));
  }

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
  const weekLabel = `${weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-[#f5f5f5] flex flex-col">
      <header className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a7b] text-white px-4 py-3 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
        <h2 className="text-lg font-bold">Service Calendar</h2>
        <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">
          ×
        </button>
      </header>

      <div className="bg-white border-b border-[#ddd] px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {(["month", "week", "list", "fridays"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                view === v ? "bg-[#1e3a5f] text-white" : "bg-[#f0f0f0] text-[#333] hover:bg-[#e0e0e0]"
              }`}
            >
              {v === "fridays" ? serviceWeekdayLabel : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {(view === "month" || view === "week") && (
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="rounded-md bg-[#f0f0f0] px-2.5 py-1 text-sm hover:bg-[#e0e0e0]">
              ‹
            </button>
            <span className="text-sm font-semibold text-[#333] min-w-[140px] text-center">
              {view === "month" ? monthLabel : weekLabel}
            </span>
            <button onClick={() => navigate(1)} className="rounded-md bg-[#f0f0f0] px-2.5 py-1 text-sm hover:bg-[#e0e0e0]">
              ›
            </button>
            <button onClick={() => setCursor(new Date())} className="rounded-md bg-[#f0f0f0] px-3 py-1 text-xs font-semibold hover:bg-[#e0e0e0]">
              Today
            </button>
          </div>
        )}
        <button onClick={() => openNew()} className="rounded-md bg-[#1e3a5f] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#152a45]">
          + Add Event
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-5xl w-full mx-auto">
        {view === "month" && (
          <DayGrid
            days={monthGrid(cursor)}
            currentMonth={cursor.getMonth()}
            eventsForDate={eventsForDate}
            onDayClick={openNew}
            onEventClick={setEditingEvent}
          />
        )}
        {view === "week" && (
          <DayGrid days={weekDays} eventsForDate={eventsForDate} onDayClick={openNew} onEventClick={setEditingEvent} />
        )}
        {view === "list" && <ListView events={events} onEventClick={setEditingEvent} />}
        {view === "fridays" && (
          <ListView events={events.filter((e) => matchesWeekday(e, serviceWeekday))} onEventClick={setEditingEvent} />
        )}
      </div>

      {editingEvent !== null && (
        <EventForm
          event={editingEvent === "new" ? null : editingEvent}
          defaultDate={newEventDate}
          onClose={() => setEditingEvent(null)}
          onSaved={onRefresh}
        />
      )}
    </div>,
    document.body,
  );
}
