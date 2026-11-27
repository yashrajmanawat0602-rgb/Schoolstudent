import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  MapPin,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import { SchoolEventItem } from '../types/index.ts';
import { useToast } from './ui/ToastAndModal.tsx';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getEventStyle(type: SchoolEventItem['eventType']) {
  switch (type) {
    case 'EXAM':
      return {
        label: 'Exam',
        cls: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60',
        Icon: FileSpreadsheet,
      };
    case 'PTM':
      return {
        label: 'PTM',
        cls: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60',
        Icon: Users,
      };
    case 'HOLIDAY':
      return {
        label: 'Holiday',
        cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60',
        Icon: Sparkles,
      };
    case 'COMPETITION':
      return {
        label: 'Competition',
        cls: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60',
        Icon: Award,
      };
    default:
      return {
        label: 'School Event',
        cls: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        Icon: CalendarDays,
      };
  }
}

export const SchoolCalendarView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [events, setEvents] = useState<SchoolEventItem[]>([]);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(10); // November 2026
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<SchoolEventItem['eventType']>('EVENT');
  const [eventDate, setEventDate] = useState('2026-11-30');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [location, setLocation] = useState('Main Auditorium');
  const [description, setDescription] = useState('');

  const loadEvents = async () => {
    try {
      const rows = await apiFetch<SchoolEventItem[]>('/api/events');
      setEvents(rows);
    } catch (err: any) {
      showToast('Failed to load calendar', err?.message, 'error');
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return events.filter((ev) => {
      if (typeFilter !== 'ALL' && ev.eventType !== typeFilter) return false;
      return ev.eventDate.startsWith(prefix);
    });
  }, [events, year, month, typeFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, SchoolEventItem[]>();
    for (const ev of events) {
      if (typeFilter !== 'ALL' && ev.eventType !== typeFilter) continue;
      const list = map.get(ev.eventDate) || [];
      list.push(ev);
      map.set(ev.eventDate, list);
    }
    return map;
  }, [events, typeFilter]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateStr: string | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: null });
    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        day: d,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
    }
    return cells;
  }, [year, month]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/events', {
        method: 'POST',
        body: JSON.stringify({
          title,
          eventType,
          eventDate,
          startTime,
          location,
          description,
        }),
      });
      showToast('Event Added', 'School calendar updated.');
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      loadEvents();
    } catch (err: any) {
      showToast('Could not create event', err?.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            School Calendar
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Exams, Parent–Teacher Meetings, holidays, competitions, and campus events
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white hover:opacity-90 self-start whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {['ALL', 'EXAM', 'PTM', 'EVENT', 'COMPETITION', 'HOLIDAY'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                typeFilter === t
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t === 'ALL' ? 'All Events' : t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (month === 0) {
                setMonth(11);
                setYear((y) => y - 1);
              } else {
                setMonth((m) => m - 1);
              }
            }}
            aria-label="Previous month"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[130px] text-center">
            {MONTHS[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => {
              if (month === 11) {
                setMonth(0);
                setYear((y) => y + 1);
              } else {
                setMonth((m) => m + 1);
              }
            }}
            aria-label="Next month"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((cell, idx) => {
              if (!cell.day || !cell.dateStr) return <div key={idx} className="h-20" />;
              const dayEvents = eventsByDate.get(cell.dateStr) || [];
              return (
                <div
                  key={cell.dateStr}
                  className="h-20 rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 flex flex-col justify-between overflow-hidden"
                >
                  <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {cell.day}
                  </span>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 2).map((ev) => {
                      const st = getEventStyle(ev.eventType);
                      return (
                        <div
                          key={ev.id}
                          title={ev.title}
                          className={`text-[10px] font-medium px-1 py-0.5 rounded border truncate ${st.cls}`}
                        >
                          {ev.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Schedule for {MONTHS[month]} {year}
          </h3>
          {filteredEvents.length === 0 ? (
            <p className="text-sm text-slate-500">
              No scheduled events for this month.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((ev) => {
                const st = getEventStyle(ev.eventType);
                const Icon = st.Icon;
                return (
                  <div
                    key={ev.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-semibold ${st.cls}`}>
                        <Icon className="w-3 h-3" />
                        {st.label}
                      </span>
                      <span className="font-mono text-slate-500">{ev.eventDate}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {ev.title}
                    </h4>
                    {ev.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {ev.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      {ev.startTime && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {ev.startTime}
                        </span>
                      )}
                      {ev.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {ev.location}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-base font-semibold">Add School Calendar Event</h3>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={eventType}
                  onChange={(e) =>
                    setEventType(e.target.value as SchoolEventItem['eventType'])
                  }
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="EVENT">School Event</option>
                  <option value="PTM">PTM</option>
                  <option value="EXAM">Exam</option>
                  <option value="COMPETITION">Competition</option>
                  <option value="HOLIDAY">Holiday</option>
                </select>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="10:00 AM"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Event description"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--sc-primary)] text-white"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
