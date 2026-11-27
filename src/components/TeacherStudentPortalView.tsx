import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Download,
  Edit3,
  KeyRound,
  MessageSquarePlus,
  Paperclip,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { apiFetch, downloadProtectedFile } from '../services/api.ts';
import { StudentDetailRecord, StudentOverviewResponse } from '../types/index.ts';
import { StudentActivitiesSection } from './StudentActivitiesSection.tsx';
import { StudentDetailsModal, StudentFormValues } from './StudentDetailsModal.tsx';
import {
  DashboardSkeleton,
  FriendlyErrorView,
  useToast,
} from './ui/ToastAndModal.tsx';

function getTodayIso(): string {
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

function getAttendanceBadge(status: string) {
  switch (status) {
    case 'PRESENT':
      return {
        label: 'Present',
        dot: 'bg-emerald-500',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
      };
    case 'LATE':
      return {
        label: 'Late',
        dot: 'bg-amber-500',
        cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
      };
    case 'ABSENT':
      return {
        label: 'Absent',
        dot: 'bg-red-500',
        cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
      };
    case 'EXCUSED':
      return {
        label: 'Excused',
        dot: 'bg-blue-500',
        cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
      };
    default:
      return {
        label: 'Holiday',
        dot: 'bg-slate-400',
        cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      };
  }
}

interface TeacherStudentPortalViewProps {
  student: StudentDetailRecord;
  classes: Array<{ id: number; name: string; section: string }>;
  subjects: Array<{ id: number; name: string }>;
  exams: Array<{ id: number; name: string; examDate: string }>;
  onBack: () => void;
  onDataChanged: () => void;
}

export const TeacherStudentPortalView: React.FC<TeacherStudentPortalViewProps> = ({
  student,
  classes,
  subjects,
  exams,
  onBack,
  onDataChanged,
}) => {
  const { showToast } = useToast();

  const [studentRecord, setStudentRecord] = useState<StudentDetailRecord>(student);
  const [overview, setOverview] = useState<StudentOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [selectedExamFilter, setSelectedExamFilter] = useState('ALL');

  // Edit full profile modal
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Quick portal password setup / reset
  const [portalPasswordDraft, setPortalPasswordDraft] = useState('');
  const [savingPortalPassword, setSavingPortalPassword] = useState(false);

  // Enter Mark Form + Inline Quick Create Exam
  const [localExams, setLocalExams] = useState(exams);
  const [markSubjectId, setMarkSubjectId] = useState<number>(subjects[0]?.id || 0);
  const [markExamId, setMarkExamId] = useState<number>(exams[0]?.id || 0);
  const [obtainedMarks, setObtainedMarks] = useState<number>(85);
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [markRemark, setMarkRemark] = useState('');
  const [savingMark, setSavingMark] = useState(false);
  const [showNewExam, setShowNewExam] = useState(exams.length === 0);
  const [newExamName, setNewExamName] = useState('');
  const [newExamDate, setNewExamDate] = useState<string>(getTodayIso());
  const [creatingExam, setCreatingExam] = useState(false);

  // Log Attendance Form
  const [attDate, setAttDate] = useState<string>(getTodayIso());
  const [attStatus, setAttStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'HOLIDAY'>('PRESENT');
  const [attNote, setAttNote] = useState('');
  const [savingAtt, setSavingAtt] = useState(false);

  // Add Homework Form
  const [showHwForm, setShowHwForm] = useState(false);
  const [hwSubjectId, setHwSubjectId] = useState<number>(subjects[0]?.id || 0);
  const [hwTitle, setHwTitle] = useState('');
  const [hwDueDate, setHwDueDate] = useState<string>(getTodayIso());
  const [hwPriority, setHwPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [hwDescription, setHwDescription] = useState('');
  const [hwFile, setHwFile] = useState<File | null>(null);
  const [savingHw, setSavingHw] = useState(false);

  // Add Teacher Remark Form
  const [remSubjectId, setRemSubjectId] = useState<number>(subjects[0]?.id || 0);
  const [remCategory, setRemCategory] = useState<'ACADEMIC' | 'BEHAVIOR' | 'PROGRESS'>('PROGRESS');
  const [remText, setRemText] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);

  useEffect(() => {
    setStudentRecord(student);
  }, [student]);

  useEffect(() => {
    setLocalExams(exams);
  }, [exams]);

  useEffect(() => {
    if (subjects[0] && !markSubjectId) setMarkSubjectId(subjects[0].id);
    if (subjects[0] && !hwSubjectId) setHwSubjectId(subjects[0].id);
    if (subjects[0] && !remSubjectId) setRemSubjectId(subjects[0].id);
    if (localExams[0] && !markExamId) setMarkExamId(localExams[0].id);
  }, [subjects, localExams]);

  const loadStudentOverview = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<StudentOverviewResponse>(`/api/students/${student.id}/overview`);
        setOverview(data);
        setStudentRecord((prev) => ({
          ...prev,
          ...data.student,
          hasPortalAccount: prev.hasPortalAccount,
        }));
      } catch (err: any) {
        setError({
          status: err?.status,
          message: err?.message || 'Unable to open student account.',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [student.id]
  );

  useEffect(() => {
    void loadStudentOverview(false);
  }, [loadStudentOverview]);

  const examOptions = useMemo(() => {
    if (!overview) return [];
    return Array.from(new Set(overview.marks.map((m) => m.examName)));
  }, [overview]);

  const filteredMarks = useMemo(() => {
    if (!overview) return [];
    if (selectedExamFilter === 'ALL') return overview.marks;
    return overview.marks.filter((m) => m.examName === selectedExamFilter);
  }, [overview, selectedExamFilter]);

  const averagePct = useMemo(() => {
    if (filteredMarks.length === 0) return 0;
    const sum = filteredMarks.reduce((acc, m) => acc + m.percentage, 0);
    return Math.round((sum / filteredMarks.length) * 10) / 10;
  }, [filteredMarks]);

  const upcomingHomework = useMemo(() => {
    if (!overview) return [];
    const today = getTodayIso();
    const upcoming = overview.homework.filter((hw) => hw.dueDate >= today);
    return upcoming.length > 0 ? upcoming : overview.homework;
  }, [overview]);

  const handleSaveProfileDetails = async (values: StudentFormValues) => {
    try {
      const updated = await apiFetch<StudentDetailRecord>(`/api/teacher/students/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...values,
          portalPassword: values.portalPassword || undefined,
        }),
      });
      setStudentRecord((prev) => ({ ...prev, ...updated }));
      setEditModalOpen(false);
      showToast('Student Account Updated', `${values.fullName} profile & credentials saved.`);
      await loadStudentOverview(true);
      onDataChanged();
    } catch (err: any) {
      showToast('Could not update student', err?.message, 'error');
    }
  };

  const handleSavePortalPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (portalPasswordDraft.length < 8) {
      showToast('Password too short', 'Portal password must be at least 8 characters.', 'error');
      return;
    }
    setSavingPortalPassword(true);
    try {
      const updated = await apiFetch<StudentDetailRecord>(`/api/teacher/students/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ portalPassword: portalPasswordDraft }),
      });
      setStudentRecord((prev) => ({ ...prev, ...updated, hasPortalAccount: true }));
      setPortalPasswordDraft('');
      showToast(
        'Student Portal Account Ready',
        `${studentRecord.fullName} can now sign in with ID ${studentRecord.studentCode}.`
      );
      onDataChanged();
    } catch (err: any) {
      showToast('Could not update portal credentials', err?.message, 'error');
    } finally {
      setSavingPortalPassword(false);
    }
  };

  const handleQuickCreateExam = async () => {
    if (newExamName.trim().length < 2) {
      showToast('Exam Name Required', 'Enter an exam name (e.g. Unit Test 1).', 'error');
      return;
    }
    setCreatingExam(true);
    try {
      const created = await apiFetch<{ id: number; name: string; examDate: string }>('/api/teacher/exams', {
        method: 'POST',
        body: JSON.stringify({
          name: newExamName.trim(),
          examGroup: newExamName.trim(),
          classId: studentRecord.classId,
          subjectId: markSubjectId || null,
          examDate: newExamDate,
          maxMarks: Number(maxMarks) || 100,
        }),
      });
      setLocalExams((prev) => [...prev, created]);
      setMarkExamId(created.id);
      setNewExamName('');
      setShowNewExam(false);
      showToast('Exam Scheduled', `"${created.name}" is ready for marks entry.`);
      onDataChanged();
    } catch (err: any) {
      showToast('Failed to create exam', err?.message, 'error');
    } finally {
      setCreatingExam(false);
    }
  };

  const handleSaveMark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markSubjectId || !markExamId) {
      showToast('Missing selection', 'Select both a subject and an exam.', 'error');
      return;
    }
    if (Number(obtainedMarks) > Number(maxMarks)) {
      showToast('Invalid marks', 'Obtained marks cannot exceed maximum marks.', 'error');
      return;
    }
    setSavingMark(true);
    try {
      await apiFetch('/api/teacher/marks', {
        method: 'POST',
        body: JSON.stringify({
          studentId: student.id,
          subjectId: markSubjectId,
          examId: markExamId,
          obtainedMarks: Number(obtainedMarks),
          maxMarks: Number(maxMarks),
          teacherRemark: markRemark.trim() || undefined,
        }),
      });
      setMarkRemark('');
      showToast('Marks Entered', `Saved marks for ${studentRecord.fullName}.`);
      await loadStudentOverview(true);
      onDataChanged();
    } catch (err: any) {
      showToast('Failed to save marks', err?.message, 'error');
    } finally {
      setSavingMark(false);
    }
  };

  const handleDeleteMark = async (markId: number) => {
    try {
      await apiFetch(`/api/teacher/marks/${markId}`, { method: 'DELETE' });
      showToast('Mark Removed', 'Mark entry deleted from student record.');
      await loadStudentOverview(true);
      onDataChanged();
    } catch (err: any) {
      showToast('Delete failed', err?.message, 'error');
    }
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAtt(true);
    try {
      await apiFetch('/api/teacher/attendance', {
        method: 'POST',
        body: JSON.stringify({
          classId: studentRecord.classId,
          date: attDate,
          records: [
            {
              studentId: student.id,
              status: attStatus,
              note: attNote.trim() || undefined,
            },
          ],
        }),
      });
      setAttNote('');
      showToast('Attendance Recorded', `${studentRecord.fullName} marked ${attStatus} for ${attDate}.`);
      await loadStudentOverview(true);
      onDataChanged();
    } catch (err: any) {
      showToast('Failed to record attendance', err?.message, 'error');
    } finally {
      setSavingAtt(false);
    }
  };

  const handleSaveHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwSubjectId) {
      showToast('Subject Required', 'Please select a subject.', 'error');
      return;
    }
    setSavingHw(true);
    try {
      const formData = new FormData();
      formData.append('title', hwTitle);
      formData.append('description', hwDescription);
      formData.append('classId', String(studentRecord.classId));
      formData.append('subjectId', String(hwSubjectId));
      formData.append('dueDate', hwDueDate);
      formData.append('priority', hwPriority);
      if (hwFile) {
        formData.append('file', hwFile);
      }
      await apiFetch('/api/teacher/homework', {
        method: 'POST',
        body: formData,
      });
      setHwTitle('');
      setHwDescription('');
      setHwFile(null);
      setShowHwForm(false);
      showToast('Homework Posted', `Assigned to ${studentRecord.className}-${studentRecord.section}.`);
      await loadStudentOverview(true);
      onDataChanged();
    } catch (err: any) {
      showToast('Failed to post homework', err?.message, 'error');
    } finally {
      setSavingHw(false);
    }
  };

  const handleSaveRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (remText.trim().length < 3) {
      showToast('Remark too short', 'Please write at least 3 characters.', 'error');
      return;
    }
    setSavingRemark(true);
    try {
      await apiFetch('/api/teacher/remarks', {
        method: 'POST',
        body: JSON.stringify({
          studentId: student.id,
          subjectId: remSubjectId || undefined,
          remark: remText.trim(),
          category: remCategory,
        }),
      });
      setRemText('');
      showToast('Remark Saved', `Feedback added for ${studentRecord.fullName}.`);
      await loadStudentOverview(true);
      onDataChanged();
    } catch (err: any) {
      showToast('Failed to save remark', err?.message, 'error');
    } finally {
      setSavingRemark(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  if (error || !overview) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Assigned Class
        </button>
        <FriendlyErrorView
          status={error?.status}
          message={error?.message || 'Unable to load student account.'}
          onRetry={() => void loadStudentOverview(false)}
        />
      </div>
    );
  }

  const todayIso = getTodayIso();

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Class
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {overview.student.fullName}
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                  studentRecord.hasPortalAccount
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                }`}
              >
                {studentRecord.hasPortalAccount ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Student Portal Active
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3 h-3" /> Portal Login Not Set
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Class {overview.student.className}-{overview.student.section} · Roll #{overview.student.rollNumber} ·
              School ID <span className="font-mono font-semibold">{overview.student.studentCode}</span> · Class Teacher Student Account Workspace
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadStudentOverview(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold hover:opacity-90"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Full Profile &amp; Credentials
          </button>
        </div>
      </div>

      {/* Student Portal Login Account Control */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[var(--sc-primary)]" />
            Student Dashboard Login Account
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {studentRecord.hasPortalAccount
              ? `Active login ID: ${overview.student.studentCode}. You can issue a new password below if the student needs a reset.`
              : `Create a password so ${overview.student.fullName} can sign in with School ID ${overview.student.studentCode} to view these exact records on their Student Dashboard.`}
          </p>
        </div>
        <form onSubmit={handleSavePortalPassword} className="flex items-center gap-2 shrink-0">
          <input
            type="password"
            minLength={8}
            required
            value={portalPasswordDraft}
            onChange={(e) => setPortalPasswordDraft(e.target.value)}
            placeholder={studentRecord.hasPortalAccount ? 'New password (min 8 chars)' : 'Set password (min 8 chars)'}
            className="w-52 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={savingPortalPassword}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-60 whitespace-nowrap"
          >
            {savingPortalPassword
              ? 'Saving...'
              : studentRecord.hasPortalAccount
                ? 'Reset Password'
                : 'Activate Portal'}
          </button>
        </form>
      </div>

      {/* KPI Cards (Matching StudentDashboard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Marks Average</span>
            <Award className="w-4 h-4 text-[var(--sc-primary)] dark:text-blue-400" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums">
            {overview.marks.length > 0 ? `${averagePct}%` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {filteredMarks.length} graded entries
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Attendance Rate</span>
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums">
            {overview.attendance.summary.percentage}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {overview.attendance.summary.present + overview.attendance.summary.late}/
            {overview.attendance.summary.totalSchoolDays} school days
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Upcoming Homework</span>
            <BookOpen className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums">
            {upcomingHomework.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {upcomingHomework[0] ? `Next due ${upcomingHomework[0].dueDate}` : 'No pending homework'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Upcoming Exams</span>
            <CalendarClock className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums">
            {overview.upcomingExams.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {overview.upcomingExams[0] ? `Next: ${overview.upcomingExams[0].examDate}` : 'No exams scheduled'}
          </div>
        </div>
      </div>

      {/* Student Marks + Enter Marks Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold">Student Marks</h2>
              <p className="text-xs text-slate-500">
                Matches what {overview.student.fullName} sees on their Student Dashboard
              </p>
            </div>
            {examOptions.length > 1 && (
              <select
                value={selectedExamFilter}
                onChange={(e) => setSelectedExamFilter(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="ALL">All Exams</option>
                {examOptions.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
            )}
          </div>

          {filteredMarks.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No marks entered yet. Use the form on the right to enter {overview.student.fullName}&apos;s marks.
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
                    <th className="py-2.5 px-3 font-medium text-right">Grade</th>
                    <th className="py-2.5 pl-2 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMarks.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 pr-3">
                        <div className="font-medium">{m.subjectName}</div>
                        {m.teacherRemark && (
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">
                            {m.teacherRemark}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400">
                        <div>{m.examName}</div>
                        <div className="font-mono text-[11px] text-slate-400">{m.examDate}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-medium">
                        {m.obtainedMarks}/{m.maxMarks}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {m.percentage}%
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-[var(--sc-primary)] dark:bg-blue-950/50 dark:text-blue-300">
                          {m.grade}
                        </span>
                      </td>
                      <td className="py-3 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => void handleDeleteMark(m.id)}
                          title="Delete mark"
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Enter / Update Student Marks Form */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="text-sm font-semibold mb-1">Enter / Update Mark for {overview.student.fullName}</h3>
          <p className="text-xs text-slate-500 mb-4">
            Saves immediately to the student&apos;s record and notifies student &amp; parent.
          </p>
          <form onSubmit={handleSaveMark} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Subject *</label>
              <select
                required
                value={markSubjectId}
                onChange={(e) => setMarkSubjectId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {subjects.length === 0 ? (
                  <option value={0}>No subjects configured</option>
                ) : (
                  subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-500">Exam *</label>
                <button
                  type="button"
                  onClick={() => setShowNewExam((v) => !v)}
                  className="text-[11px] font-semibold text-[var(--sc-primary)] hover:underline"
                >
                  {showNewExam ? 'Cancel New Exam' : '+ New Exam'}
                </button>
              </div>
              {showNewExam ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 space-y-2">
                  <input
                    type="text"
                    value={newExamName}
                    onChange={(e) => setNewExamName(e.target.value)}
                    placeholder="Exam title (e.g. Unit Test 1)"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newExamDate}
                      onChange={(e) => setNewExamDate(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      disabled={creatingExam}
                      onClick={() => void handleQuickCreateExam()}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-50"
                    >
                      {creatingExam ? 'Adding...' : 'Create Exam'}
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  required
                  value={markExamId}
                  onChange={(e) => setMarkExamId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  {localExams.length === 0 ? (
                    <option value={0}>No exams scheduled — click + New Exam</option>
                  ) : (
                    localExams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} ({ex.examDate})
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Obtained Marks *</label>
                <input
                  type="number"
                  min={0}
                  max={maxMarks}
                  required
                  value={obtainedMarks}
                  onChange={(e) => setObtainedMarks(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Max Marks *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(Number(e.target.value) || 100)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Subject Remark (Optional)</label>
              <input
                type="text"
                value={markRemark}
                onChange={(e) => setMarkRemark(e.target.value)}
                placeholder="e.g. Strong improvement in algebra"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={savingMark || subjects.length === 0 || localExams.length === 0}
              className="w-full py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {savingMark ? 'Saving Mark...' : 'Save Student Mark'}
            </button>
          </form>
        </section>
      </div>

      {/* Recent Attendance Records + Log Attendance Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Recent Attendance Records</h2>
            <p className="text-xs text-slate-500">
              Present {overview.attendance.summary.present} · Late {overview.attendance.summary.late} ·
              Absent {overview.attendance.summary.absent} · Excused {overview.attendance.summary.excused}
            </p>
          </div>
          {overview.attendance.records.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No attendance records logged for {overview.student.fullName} yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {overview.attendance.records.slice(0, 10).map((rec) => {
                const st = getAttendanceBadge(rec.status);
                return (
                  <div key={rec.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{formatShortDate(rec.date)}</div>
                      {rec.note && <div className="text-xs text-slate-500 truncate">{rec.note}</div>}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium shrink-0 ${st.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="text-sm font-semibold mb-1">Record / Update Attendance</h3>
          <p className="text-xs text-slate-500 mb-4">
            Log daily attendance for {overview.student.fullName} ({overview.student.className}-{overview.student.section})
          </p>
          <form onSubmit={handleSaveAttendance} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date *</label>
              <input
                type="date"
                required
                value={attDate}
                onChange={(e) => setAttDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status *</label>
              <select
                value={attStatus}
                onChange={(e) =>
                  setAttStatus(e.target.value as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'HOLIDAY')
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
                <option value="EXCUSED">Excused</option>
                <option value="HOLIDAY">Holiday</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Note (Optional)</label>
              <input
                type="text"
                value={attNote}
                onChange={(e) => setAttNote(e.target.value)}
                placeholder="Reason or gate note"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={savingAtt}
              className="w-full py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {savingAtt ? 'Saving Attendance...' : 'Save Student Attendance'}
            </button>
          </form>
        </section>
      </div>

      {/* Upcoming Homework & Teacher Remarks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Upcoming Homework</h2>
              <p className="text-xs text-slate-500">
                Tasks visible on {overview.student.fullName}&apos;s Student Dashboard
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHwForm((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" /> {showHwForm ? 'Hide Form' : 'Add Homework'}
            </button>
          </div>

          {showHwForm && (
            <form onSubmit={handleSaveHomework} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={hwSubjectId}
                  onChange={(e) => setHwSubjectId(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
                <select
                  value={hwPriority}
                  onChange={(e) => setHwPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                >
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  required
                  value={hwTitle}
                  onChange={(e) => setHwTitle(e.target.value)}
                  placeholder="Homework title"
                  className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="date"
                  required
                  value={hwDueDate}
                  onChange={(e) => setHwDueDate(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                />
              </div>
              <textarea
                rows={2}
                required
                value={hwDescription}
                onChange={(e) => setHwDescription(e.target.value)}
                placeholder="Instructions for the class..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]">
                    {hwFile ? hwFile.name : 'Attach worksheet/file (Max 10 MB)'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.size > 10 * 1024 * 1024) {
                        showToast('File Too Large', 'Maximum attachment size is 10 MB.', 'error');
                        return;
                      }
                      setHwFile(file);
                    }}
                    className="sr-only"
                  />
                </label>
                {hwFile && (
                  <button
                    type="button"
                    onClick={() => setHwFile(null)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-600"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={savingHw}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold disabled:opacity-50"
              >
                {savingHw ? 'Posting...' : `Post to ${overview.student.className}-${overview.student.section}`}
              </button>
            </form>
          )}

          {upcomingHomework.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No homework assigned for {overview.student.className}-{overview.student.section} yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingHomework.slice(0, 6).map((hw) => {
                const isDueToday = hw.dueDate === todayIso;
                return (
                  <div key={hw.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                        {hw.subjectName}
                      </span>
                      <span className="font-mono text-slate-500">
                        {isDueToday ? 'Due Today' : `Due ${hw.dueDate}`}
                      </span>
                    </div>
                    <div className="text-sm font-semibold">{hw.title}</div>
                    {hw.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{hw.description}</p>
                    )}
                    {hw.attachmentUrl && hw.attachmentName && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadProtectedFile(hw.attachmentUrl!, hw.attachmentName!).catch(() =>
                            showToast('Download failed', 'Could not download attachment.', 'error')
                          )
                        }
                        className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
                      >
                        <Download className="w-3 h-3" />
                        <span className="truncate max-w-[220px]">{hw.attachmentName}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Teacher Remarks & Add Remark */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-[var(--sc-primary)]" />
              Teacher Remarks for {overview.student.fullName}
            </h2>
            <p className="text-xs text-slate-500">Academic, progress, and behavioral notes</p>
          </div>

          <form onSubmit={handleSaveRemark} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={remSubjectId}
                onChange={(e) => setRemSubjectId(Number(e.target.value))}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
              <select
                value={remCategory}
                onChange={(e) => setRemCategory(e.target.value as 'ACADEMIC' | 'BEHAVIOR' | 'PROGRESS')}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
              >
                <option value="PROGRESS">Progress</option>
                <option value="ACADEMIC">Academic</option>
                <option value="BEHAVIOR">Behavior</option>
              </select>
            </div>
            <textarea
              rows={2}
              required
              value={remText}
              onChange={(e) => setRemText(e.target.value)}
              placeholder={`Write remark for ${overview.student.fullName}...`}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={savingRemark}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold disabled:opacity-50"
            >
              {savingRemark ? 'Saving...' : 'Save Remark'}
            </button>
          </form>

          {overview.remarks.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-500">No teacher remarks logged yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {overview.remarks.slice(0, 5).map((r) => (
                <div key={r.id} className="py-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                      {r.category} {r.subjectName ? `· ${r.subjectName}` : ''}
                    </span>
                    <span className="font-mono">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200">{r.remark}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <StudentActivitiesSection
        studentId={overview.student.id}
        studentName={overview.student.fullName}
        activities={overview.activities || []}
        canManage={true}
        onChanged={async () => {
          await loadStudentOverview(true);
          onDataChanged();
        }}
      />

      {/* Complete Student Profile Details */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[var(--sc-primary)]" />
              Complete Student Profile &amp; Family Details
            </h2>
            <p className="text-xs text-slate-500">
              All personal, guardian, emergency, and health records shown on the student&apos;s portal
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit All Details
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-slate-500">Date of Birth</div>
            <div className="font-medium mt-0.5 font-mono">{overview.student.dateOfBirth || 'Not entered'}</div>
          </div>
          <div>
            <div className="text-slate-500">Gender &amp; Blood Group</div>
            <div className="font-medium mt-0.5">
              {overview.student.gender || 'Not specified'} · {overview.student.bloodGroup || '—'}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Admission Date</div>
            <div className="font-medium mt-0.5 font-mono">{overview.student.admissionDate || '—'}</div>
          </div>
          <div>
            <div className="text-slate-500">School House</div>
            <div className="font-medium mt-0.5">{overview.student.houseName || '—'}</div>
          </div>
          <div>
            <div className="text-slate-500">Father&apos;s Name</div>
            <div className="font-medium mt-0.5">{overview.student.fatherName || 'Not entered'}</div>
          </div>
          <div>
            <div className="text-slate-500">Mother&apos;s Name</div>
            <div className="font-medium mt-0.5">{overview.student.motherName || 'Not entered'}</div>
          </div>
          <div>
            <div className="text-slate-500">Guardian Phone</div>
            <div className="font-medium mt-0.5 font-mono">{overview.student.guardianPhone || 'Not entered'}</div>
          </div>
          <div>
            <div className="text-slate-500">Emergency Contact</div>
            <div className="font-medium mt-0.5">{overview.student.emergencyContact || 'Not entered'}</div>
          </div>
          <div>
            <div className="text-slate-500">Guardian Email</div>
            <div className="font-medium mt-0.5">{overview.student.guardianEmail || '—'}</div>
          </div>
          <div>
            <div className="text-slate-500">Previous School</div>
            <div className="font-medium mt-0.5">{overview.student.previousSchool || '—'}</div>
          </div>
          <div className="col-span-2">
            <div className="text-slate-500">Residential Address</div>
            <div className="font-medium mt-0.5">{overview.student.address || 'Not entered'}</div>
          </div>
          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
            <div className="text-slate-500">Medical / Health Notes</div>
            <div className="font-medium mt-0.5">{overview.student.medicalNotes || 'None noted'}</div>
          </div>
        </div>
      </section>

      <StudentDetailsModal
        open={editModalOpen}
        mode="edit"
        role="TEACHER"
        student={studentRecord}
        classes={classes}
        defaultClassId={studentRecord.classId}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSaveProfileDetails}
      />
    </div>
  );
};
