import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookMarked,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  Clock,
  Download,
  Megaphone,
  RefreshCw,
  UserCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, downloadProtectedFile } from '../services/api.ts';
import { NoticeItem, StudentOverviewResponse } from '../types/index.ts';
import { FirestoreNotesCard } from './FirestoreNotesCard.tsx';
import { StudentActivitiesSection } from './StudentActivitiesSection.tsx';
import {
  DashboardSkeleton,
  EmptyState,
  FriendlyErrorView,
  useToast,
} from './ui/ToastAndModal.tsx';

function getGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good Morning';
  if (hr < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getAttendanceStatusStyle(status: string): {
  label: string;
  dotClass: string;
  badgeClass: string;
} {
  switch (status) {
    case 'PRESENT':
      return {
        label: 'Present',
        dotClass: 'bg-emerald-500',
        badgeClass:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
      };
    case 'LATE':
      return {
        label: 'Late',
        dotClass: 'bg-amber-500',
        badgeClass:
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
      };
    case 'ABSENT':
      return {
        label: 'Absent',
        dotClass: 'bg-red-500',
        badgeClass:
          'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
      };
    case 'EXCUSED':
      return {
        label: 'Excused',
        dotClass: 'bg-blue-500',
        badgeClass:
          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
      };
    default:
      return {
        label: 'Holiday',
        dotClass: 'bg-slate-400',
        badgeClass:
          'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      };
  }
}

export interface StudentDashboardProps {
  studentId?: number | null;
  onNavigateTab?: (tab: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  studentId,
  onNavigateTab,
}) => {
  const { studentProfile, user } = useAuth();
  const { showToast } = useToast();

  const resolvedStudentId = studentId ?? studentProfile?.id ?? null;

  const [overview, setOverview] = useState<StudentOverviewResponse | null>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [selectedExam, setSelectedExam] = useState<string>('ALL');

  const fetchDashboardData = useCallback(
    async (isManualRefresh = false) => {
      if (!resolvedStudentId) {
        setLoading(false);
        return;
      }

      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [overviewData, noticeRows] = await Promise.all([
          apiFetch<StudentOverviewResponse>(`/api/students/${resolvedStudentId}/overview`),
          apiFetch<NoticeItem[]>('/api/notices').catch(() => [] as NoticeItem[]),
        ]);
        setOverview(overviewData);
        setNotices(noticeRows);
      } catch (err: any) {
        setError({
          status: err?.status,
          message: err?.message || 'Unable to load student dashboard records.',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [resolvedStudentId]
  );

  useEffect(() => {
    void fetchDashboardData(false);
  }, [fetchDashboardData]);

  const examOptions = useMemo(() => {
    if (!overview) return [];
    return Array.from(new Set(overview.marks.map((m) => m.examName)));
  }, [overview]);

  const filteredMarks = useMemo(() => {
    if (!overview) return [];
    if (selectedExam === 'ALL') return overview.marks;
    return overview.marks.filter((m) => m.examName === selectedExam);
  }, [overview, selectedExam]);

  const overallAveragePct = useMemo(() => {
    if (filteredMarks.length === 0) return 0;
    const sum = filteredMarks.reduce((acc, m) => acc + m.percentage, 0);
    return Math.round((sum / filteredMarks.length) * 10) / 10;
  }, [filteredMarks]);

  const upcomingHomework = useMemo(() => {
    if (!overview) return [];
    const today = getTodayIsoDate();
    const upcoming = overview.homework.filter((hw) => hw.dueDate >= today);
    return upcoming.length > 0 ? upcoming : overview.homework;
  }, [overview]);

  const recentAttendance = useMemo(() => {
    if (!overview) return [];
    return overview.attendance.records.slice(0, 10);
  }, [overview]);

  if (!resolvedStudentId) {
    return (
      <EmptyState
        icon={<UserCircle2 className="w-6 h-6" />}
        title="Student profile not linked"
        description="Please contact your school administrator to link your account to an active student enrollment."
      />
    );
  }

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <FriendlyErrorView
        status={error.status}
        message={error.message}
        onRetry={() => void fetchDashboardData(false)}
      />
    );
  }

  if (!overview) return <DashboardSkeleton />;

  const todayIso = getTodayIsoDate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {getGreeting()}, {overview.student.fullName || user?.fullName}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {overview.student.className}-{overview.student.section} · Roll #
            {overview.student.rollNumber} · Student ID{' '}
            <span className="font-mono">{overview.student.studentCode}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchDashboardData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 self-start sm:self-auto px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab?.('academics')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-[var(--sc-primary)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Marks Average</span>
            <Award className="w-4 h-4 text-[var(--sc-primary)] dark:text-blue-400" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {overview.marks.length > 0 ? `${overallAveragePct}%` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>{filteredMarks.length} graded entries</span>
            {onNavigateTab && <ArrowRight className="w-3.5 h-3.5" />}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab?.('attendance')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-[var(--sc-primary)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Attendance Rate</span>
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {overview.attendance.summary.percentage}%
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>
              {overview.attendance.summary.present + overview.attendance.summary.late}/
              {overview.attendance.summary.totalSchoolDays} school days
            </span>
            {onNavigateTab && <ArrowRight className="w-3.5 h-3.5" />}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab?.('homework')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-[var(--sc-primary)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Upcoming Homework</span>
            <BookOpen className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {upcomingHomework.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>
              {upcomingHomework[0]
                ? `Next due ${upcomingHomework[0].dueDate}`
                : 'No pending homework'}
            </span>
            {onNavigateTab && <ArrowRight className="w-3.5 h-3.5" />}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab?.('exams')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-[var(--sc-primary)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Upcoming Exams</span>
            <CalendarClock className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {overview.upcomingExams.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>
              {overview.upcomingExams[0]
                ? `Next: ${overview.upcomingExams[0].examDate}`
                : 'No exams scheduled'}
            </span>
            {onNavigateTab && <ArrowRight className="w-3.5 h-3.5" />}
          </div>
        </button>
      </div>

      {/* Student Marks & Upcoming Homework */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Marks Section */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Student Marks
              </h2>
              <p className="text-xs text-slate-500">
                Subject-wise examination scores and remarks
              </p>
            </div>

            <div className="flex items-center gap-2">
              {examOptions.length > 1 && (
                <select
                  aria-label="Filter marks by exam"
                  value={selectedExam}
                  onChange={(e) => setSelectedExam(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--sc-primary)]"
                >
                  <option value="ALL">All Exams</option>
                  {examOptions.map((ex) => (
                    <option key={ex} value={ex}>
                      {ex}
                    </option>
                  ))}
                </select>
              )}
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('academics')}
                  className="text-xs font-medium text-[var(--sc-primary)] dark:text-blue-400 hover:underline whitespace-nowrap"
                >
                  Full Report
                </button>
              )}
            </div>
          </div>

          {filteredMarks.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No marks have been recorded for your account yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    <th className="py-2.5 pr-3 font-medium">Subject</th>
                    <th className="py-2.5 px-3 font-medium">Exam</th>
                    <th className="py-2.5 px-3 font-medium text-right">Score</th>
                    <th className="py-2.5 px-3 font-medium text-right">%</th>
                    <th className="py-2.5 pl-3 font-medium text-right">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMarks.slice(0, 8).map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {m.subjectName}
                        </div>
                        {m.teacherRemark && (
                          <div className="text-xs text-slate-500 truncate max-w-[220px]">
                            {m.teacherRemark}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400">
                        <div>{m.examName}</div>
                        <div className="font-mono text-[11px] text-slate-400">{m.examDate}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {m.obtainedMarks}/{m.maxMarks}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {m.percentage}%
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-[var(--sc-primary)] dark:bg-blue-950/50 dark:text-blue-300">
                          {m.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Upcoming Homework Section */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Upcoming Homework
              </h2>
              <p className="text-xs text-slate-500">
                Class tasks ordered by due date
              </p>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('homework')}
                className="text-xs font-medium text-[var(--sc-primary)] dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                View All
              </button>
            )}
          </div>

          {upcomingHomework.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No upcoming homework assigned for your class.
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingHomework.slice(0, 5).map((hw) => {
                const isDueToday = hw.dueDate === todayIso;
                const isPastDue = hw.dueDate < todayIso;
                return (
                  <div
                    key={hw.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                        {hw.subjectName}
                      </span>
                      <span
                        className={`font-mono px-2 py-0.5 rounded-md border text-[11px] ${
                          isPastDue
                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
                            : isDueToday
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                              : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {isDueToday ? 'Due Today' : `Due ${hw.dueDate}`}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {hw.title}
                    </div>
                    {hw.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {hw.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <span>
                        By {hw.teacherName} · {hw.priority} priority
                      </span>
                      {hw.attachmentUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            downloadProtectedFile(
                              hw.attachmentUrl!,
                              hw.attachmentName || 'homework-attachment'
                            ).catch((err) =>
                              showToast('Download failed', err?.message || 'Unable to download', 'error')
                            );
                          }}
                          className="inline-flex items-center gap-1 text-[var(--sc-primary)] dark:text-blue-400 font-medium hover:underline max-w-[200px]"
                        >
                          <Download className="w-3 h-3 shrink-0" />
                          <span className="truncate">{hw.attachmentName || 'Attachment'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Recent Attendance Records & Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Attendance Records */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Recent Attendance Records
              </h2>
              <p className="text-xs text-slate-500">
                Present {overview.attendance.summary.present} · Late{' '}
                {overview.attendance.summary.late} · Absent{' '}
                {overview.attendance.summary.absent} · Excused{' '}
                {overview.attendance.summary.excused}
              </p>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('attendance')}
                className="text-xs font-medium text-[var(--sc-primary)] dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                Full Calendar
              </button>
            )}
          </div>

          {recentAttendance.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No attendance records logged yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentAttendance.map((rec) => {
                const st = getAttendanceStatusStyle(rec.status);
                return (
                  <div
                    key={rec.id}
                    className="py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {formatShortDate(rec.date)}
                      </div>
                      {rec.note && (
                        <div className="text-xs text-slate-500 truncate">{rec.note}</div>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium shrink-0 ${st.badgeClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dotClass}`} />
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Notices & Study Shortcuts */}
        <section className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-slate-500" />
                Recent Notices
              </h2>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('notices')}
                  className="text-xs font-medium text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
                >
                  Notice Board
                </button>
              )}
            </div>
            {notices.length === 0 ? (
              <p className="text-sm text-slate-500 py-3">No recent notices.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notices.slice(0, 3).map((n) => (
                  <div key={n.id} className="py-2.5 space-y-1">
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                        {n.category}
                      </span>{' '}
                      · {n.priority}
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {n.title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {onNavigateTab && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onNavigateTab('notes')}
                className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-[var(--sc-primary)] transition-colors"
              >
                <BookMarked className="w-4 h-4 text-[var(--sc-primary)] dark:text-blue-400 mb-2" />
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Study Notes Library
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Class materials &amp; PDFs</div>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('timetable')}
                className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-[var(--sc-primary)] transition-colors"
              >
                <Clock className="w-4 h-4 text-emerald-600 mb-2" />
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Class Timetable
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Daily schedule</div>
              </button>
            </div>
          )}
        </section>
      </div>

      <StudentActivitiesSection
        studentId={overview.student.id}
        studentName={overview.student.fullName}
        activities={overview.activities || []}
      />

      <FirestoreNotesCard />
    </div>
  );
};

export default StudentDashboard;
