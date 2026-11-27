import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { StudentOverviewResponse } from '../types/index.ts';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AttendanceCalendarView: React.FC<{
  overview: StudentOverviewResponse;
}> = ({ overview }) => {
  // Default to November 2026 where seeded attendance sits
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(10); // 0-indexed: 10 = November

  const recordMap = useMemo(() => {
    const map = new Map<
      string,
      { status: string; note: string | null }
    >();
    for (const r of overview.attendance.records) {
      map.set(r.date, { status: r.status, note: r.note });
    }
    return map;
  }, [overview.attendance.records]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateStr: string | null }> = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: null, dateStr: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ day: d, dateStr: `${year}-${mm}-${dd}` });
    }
    return cells;
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const summary = overview.attendance.summary;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Attendance Record
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {overview.student.fullName} · {overview.student.className}-{overview.student.section}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total School Days
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums">
            {summary.totalSchoolDays}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Present Days
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {summary.present + summary.late}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Absent Days
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-red-700 dark:text-red-400">
            {summary.absent}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Attendance Percentage
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[var(--sc-primary)] dark:text-blue-400">
            {summary.percentage}%
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <CalendarCheck className="w-5 h-5 text-[var(--sc-primary)] dark:text-blue-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {MONTH_NAMES[month]} {year}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dual-coded Legend (Icon + Text, never hue-only) */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
            <Check className="w-3.5 h-3.5" /> Present
          </span>
          <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400 font-medium">
            <X className="w-3.5 h-3.5" /> Absent
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
            <Clock className="w-3.5 h-3.5" /> Late
          </span>
          <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium">
            <FileCheck className="w-3.5 h-3.5" /> Excused
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Holiday
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500 mb-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarCells.map((cell, idx) => {
            if (!cell.day || !cell.dateStr) {
              return <div key={`empty-${idx}`} className="h-16 sm:h-20" />;
            }
            const rec = recordMap.get(cell.dateStr);
            const status = rec?.status;

            let styleClass =
              'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-500';
            let statusBadge: React.ReactNode = null;

            if (status === 'PRESENT') {
              styleClass =
                'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200';
              statusBadge = (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                  <Check className="w-3 h-3" /> <span className="hidden sm:inline">Present</span>
                </span>
              );
            } else if (status === 'ABSENT') {
              styleClass =
                'border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-200';
              statusBadge = (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                  <X className="w-3 h-3" /> <span className="hidden sm:inline">Absent</span>
                </span>
              );
            } else if (status === 'LATE') {
              styleClass =
                'border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200';
              statusBadge = (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                  <Clock className="w-3 h-3" /> <span className="hidden sm:inline">Late</span>
                </span>
              );
            } else if (status === 'EXCUSED') {
              styleClass =
                'border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200';
              statusBadge = (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                  <FileCheck className="w-3 h-3" /> <span className="hidden sm:inline">Excused</span>
                </span>
              );
            } else if (status === 'HOLIDAY') {
              styleClass =
                'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300';
              statusBadge = (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium">
                  <Sparkles className="w-3 h-3" /> <span className="hidden sm:inline">Holiday</span>
                </span>
              );
            }

            return (
              <div
                key={cell.dateStr}
                title={rec?.note || status || 'No school record'}
                className={`h-16 sm:h-20 rounded-lg border p-2 flex flex-col justify-between text-left ${styleClass}`}
              >
                <span className="text-xs font-mono font-semibold tabular-nums">
                  {cell.day}
                </span>
                {statusBadge}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
