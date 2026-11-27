import React, { useEffect, useState } from 'react';
import { CalendarCheck, Check, Clock, FileCheck, Save, Search, Sparkles, X } from 'lucide-react';
import { apiFetch } from '../services/api.ts';
import { useToast } from './ui/ToastAndModal.tsx';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'HOLIDAY';

interface AttendanceRow {
  studentId: number;
  studentCode: string;
  fullName: string;
  rollNumber: number;
  status: AttendanceStatus;
  note: string;
  recorded: boolean;
}

export const TeacherAttendanceView: React.FC = () => {
  const { showToast } = useToast();
  const [classes, setClasses] = useState<Array<{ id: number; name: string; section: string }>>([]);
  const [classId, setClassId] = useState<number>(0);
  const [date, setDate] = useState('2026-11-20');
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    apiFetch<{ myClasses: Array<{ id: number; name: string; section: string }> }>(
      '/api/teacher/dashboard'
    )
      .then((td) => {
        setClasses(td.myClasses);
        if (td.myClasses[0]) setClassId(td.myClasses[0].id);
      })
      .catch((err) => showToast('Failed to load classes', err?.message, 'error'));
  }, []);

  useEffect(() => {
    if (!classId || !date) return;
    setLoading(true);
    apiFetch<AttendanceRow[]>(
      `/api/teacher/attendance?classId=${classId}&date=${date}`
    )
      .then(setRows)
      .catch((err) => showToast('Failed to load register', err?.message, 'error'))
      .finally(() => setLoading(false));
  }, [classId, date]);

  const setStatus = (studentId: number, status: AttendanceStatus) => {
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r))
    );
  };

  const setNote = (studentId: number, note: string) => {
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, note } : r))
    );
  };

  const markAll = (status: AttendanceStatus) => {
    setRows((prev) => prev.map((r) => ({ ...r, status })));
  };

  const handleSave = async () => {
    if (!classId || rows.length === 0) return;
    setSaving(true);
    try {
      await apiFetch('/api/teacher/attendance', {
        method: 'POST',
        body: JSON.stringify({
          classId,
          date,
          records: rows.map((r) => ({
            studentId: r.studentId,
            status: r.status,
            note: r.note,
          })),
        }),
      });
      showToast(
        'Attendance Saved',
        `Updated attendance for ${rows.length} students on ${date}.`
      );
    } catch (err: any) {
      showToast('Save Failed', err?.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const presentCount = rows.filter((r) => r.status === 'PRESENT').length;
  const absentCount = rows.filter((r) => r.status === 'ABSENT').length;
  const lateCount = rows.filter((r) => r.status === 'LATE').length;
  const q = studentSearch.trim().toLowerCase();
  const filteredRows = rows.filter(
    (r) =>
      !q ||
      r.fullName.toLowerCase().includes(q) ||
      r.studentCode.toLowerCase().includes(q) ||
      String(r.rollNumber).includes(q)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Daily Attendance Register
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Record Present, Absent, Late, Excused, or Holiday status with automatic parent notifications
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || rows.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--sc-primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 self-start whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Attendance'}
        </button>
      </div>

      {/* Controls Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Class
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}-{c.section}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-mono text-slate-600 dark:text-slate-400">
            Present: <strong>{presentCount}</strong> · Absent:{' '}
            <strong>{absentCount}</strong> · Late: <strong>{lateCount}</strong>
          </span>
          <button
            type="button"
            onClick={() => markAll('PRESENT')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
          >
            Mark All Present
          </button>
          <button
            type="button"
            onClick={() => markAll('HOLIDAY')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
          >
            Mark Holiday
          </button>
        </div>
      </div>

      {/* Register Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search student name, roll #, or Student ID..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-1.5 text-xs"
            />
          </div>
          <span className="text-xs font-mono text-slate-500">
            Showing {filteredRows.length} of {rows.length} students
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading class roster...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Roll</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Note (Optional)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-slate-500">
                      No matching students in this class register.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => {
                  const options: Array<{
                    val: AttendanceStatus;
                    label: string;
                    Icon: React.ComponentType<{ className?: string }>;
                    activeCls: string;
                  }> = [
                    {
                      val: 'PRESENT',
                      label: 'Present',
                      Icon: Check,
                      activeCls: 'bg-emerald-600 text-white border-emerald-600',
                    },
                    {
                      val: 'ABSENT',
                      label: 'Absent',
                      Icon: X,
                      activeCls: 'bg-red-600 text-white border-red-600',
                    },
                    {
                      val: 'LATE',
                      label: 'Late',
                      Icon: Clock,
                      activeCls: 'bg-amber-600 text-white border-amber-600',
                    },
                    {
                      val: 'EXCUSED',
                      label: 'Excused',
                      Icon: FileCheck,
                      activeCls: 'bg-blue-600 text-white border-blue-600',
                    },
                    {
                      val: 'HOLIDAY',
                      label: 'Holiday',
                      Icon: Sparkles,
                      activeCls: 'bg-slate-600 text-white border-slate-600',
                    },
                  ];

                  return (
                    <tr key={r.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {r.rollNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {r.fullName}
                        </div>
                        <div className="text-xs font-mono text-slate-500">
                          {r.studentCode}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {options.map((opt) => {
                            const active = r.status === opt.val;
                            const Icon = opt.Icon;
                            return (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() => setStatus(r.studentId, opt.val)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                                  active
                                    ? opt.activeCls
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={r.note}
                          onChange={(e) => setNote(r.studentId, e.target.value)}
                          placeholder="Optional note..."
                          className="w-full min-w-[160px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                        />
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <CalendarCheck className="w-4 h-4" />
        <span>
          Parents are automatically notified when their child is marked Absent or Late.
        </span>
      </div>
    </div>
  );
};
