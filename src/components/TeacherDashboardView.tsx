import React, { useEffect, useState } from 'react';
import {
  Award,
  BookMarked,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Edit3,
  FileSpreadsheet,
  FolderOpen,
  GraduationCap,
  Megaphone,
  MessageSquarePlus,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import { AuditLogItem, StudentDetailRecord } from '../types/index.ts';
import { StudentDetailsModal, StudentFormValues } from './StudentDetailsModal.tsx';
import { TeacherStudentPortalView } from './TeacherStudentPortalView.tsx';
import { DashboardSkeleton, useToast } from './ui/ToastAndModal.tsx';

interface TeacherDashboardData {
  stats: {
    totalStudents: number;
    activeAssignments: number;
    upcomingExams: number;
    activeNotices: number;
    pendingMarks: number;
  };
  myClasses: Array<{
    id: number;
    name: string;
    section: string;
    roomNumber: string | null;
    isClassTeacher?: boolean;
    studentCount?: number;
  }>;
  mySubjects: Array<{
    classId: number;
    className: string;
    section: string;
    subjectId: number;
    subjectName: string;
  }>;
  classPerformance: Array<{
    classId: number;
    className: string;
    section: string;
    avgPct: number;
  }>;
  recentMarks: Array<{
    id: number;
    studentId: number;
    studentCode: string;
    studentName: string;
    rollNumber: number;
    subjectId: number;
    subjectName: string;
    examId: number;
    examName: string;
    examDate: string;
    obtainedMarks: number;
    maxMarks: number;
    grade: string;
    teacherRemark: string | null;
    percentage: number;
  }>;
  upcomingHomework: Array<{
    id: number;
    title: string;
    description: string;
    dueDate: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    classId: number;
    className: string;
    section: string;
    subjectId: number;
    subjectName: string;
    teacherName: string;
  }>;
  recentAttendance: Array<{
    id: number;
    studentId: number;
    studentCode: string;
    studentName: string;
    rollNumber: number;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'HOLIDAY';
    note: string | null;
  }>;
  attendanceSummary: {
    totalSchoolDays: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    percentage: number;
  };
  recentActivity: AuditLogItem[];
  exams: Array<{ id: number; name: string; examDate: string }>;
  subjects: Array<{ id: number; name: string }>;
}

export const TeacherDashboardView: React.FC<{
  onNavigateTab: (tab: string) => void;
  initialView?: 'overview' | 'roster';
  aiCommand?: { query?: string; nonce: number } | null;
}> = ({ onNavigateTab, initialView = 'overview', aiCommand }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [students, setStudents] = useState<StudentDetailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'overview' | 'roster'>(initialView);

  // Opened Student Account (Class Teacher opens student portal view)
  const [openedStudent, setOpenedStudent] = useState<StudentDetailRecord | null>(null);

  // Student Details Modal (create / edit)
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState<'create' | 'edit'>('create');
  const [editingStudent, setEditingStudent] = useState<StudentDetailRecord | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterClassFilter, setRosterClassFilter] = useState(0);
  const [overviewStudentSearch, setOverviewStudentSearch] = useState('');
  const [overviewMarksSearch, setOverviewMarksSearch] = useState('');
  const [overviewAttendanceSearch, setOverviewAttendanceSearch] = useState('');

  // Academic Remark Modal
  const [remarkOpen, setRemarkOpen] = useState(false);
  const [remarkStudentId, setRemarkStudentId] = useState(0);
  const [remarkSubjectId, setRemarkSubjectId] = useState(0);
  const [remarkText, setRemarkText] = useState('');
  const [remarkCategory, setRemarkCategory] = useState<'ACADEMIC' | 'BEHAVIOR' | 'PROGRESS'>('PROGRESS');

  const loadData = async () => {
    setLoading(true);
    try {
      const [td, stuList] = await Promise.all([
        apiFetch<TeacherDashboardData>('/api/teacher/dashboard'),
        apiFetch<StudentDetailRecord[]>('/api/teacher/students'),
      ]);
      setData(td);
      setStudents(stuList);
      if (stuList[0] && !remarkStudentId) setRemarkStudentId(stuList[0].id);
      if (td.subjects[0] && !remarkSubjectId) setRemarkSubjectId(td.subjects[0].id);
      if (openedStudent) {
        const refreshedTarget = stuList.find((s) => s.id === openedStudent.id) || null;
        setOpenedStudent(refreshedTarget);
      }
    } catch (err: any) {
      showToast('Failed to load teacher workspace', err?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setViewMode(initialView);
    setOpenedStudent(null);
  }, [initialView]);

  useEffect(() => {
    if (aiCommand?.query !== undefined) {
      setRosterSearch(aiCommand.query);
    }
  }, [aiCommand?.nonce]);

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveStudent = async (values: StudentFormValues) => {
    try {
      if (studentModalMode === 'create') {
        await apiFetch('/api/teacher/students', {
          method: 'POST',
          body: JSON.stringify({
            ...values,
            password: values.password || undefined,
          }),
        });
        showToast('Student Added', `${values.fullName} added to your class roster.`);
      } else if (editingStudent) {
        await apiFetch(`/api/teacher/students/${editingStudent.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...values,
            portalPassword: values.portalPassword || undefined,
          }),
        });
        showToast('Student Details Saved', `${values.fullName} profile updated.`);
      }
      setStudentModalOpen(false);
      setEditingStudent(null);
      loadData();
    } catch (err: any) {
      showToast('Could not save student', err?.message, 'error');
    }
  };

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/teacher/remarks', {
        method: 'POST',
        body: JSON.stringify({
          studentId: remarkStudentId,
          subjectId: remarkSubjectId || undefined,
          remark: remarkText,
          category: remarkCategory,
        }),
      });
      showToast('Remark Saved', 'Parent has been notified of your academic remark.');
      setRemarkOpen(false);
      setRemarkText('');
      loadData();
    } catch (err: any) {
      showToast('Could not save remark', err?.message, 'error');
    }
  };

  if (loading || !data) return <DashboardSkeleton />;

  if (openedStudent) {
    return (
      <TeacherStudentPortalView
        student={openedStudent}
        classes={data.myClasses}
        subjects={data.subjects}
        exams={data.exams}
        onBack={() => setOpenedStudent(null)}
        onDataChanged={() => {
          void loadData();
        }}
      />
    );
  }

  const chartData = data.classPerformance.map((c) => ({
    name: `${c.className}-${c.section}`,
    Average: c.avgPct,
  }));

  const homeroomClass = data.myClasses.find((c) => c.isClassTeacher) || data.myClasses[0];
  const filteredRoster = students.filter((s) => {
    const matchesClass = !rosterClassFilter || s.classId === rosterClassFilter;
    const q = rosterSearch.trim().toLowerCase();
    const matchesQ =
      !q ||
      s.fullName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      String(s.rollNumber).includes(q) ||
      `${s.className}-${s.section}`.toLowerCase().includes(q) ||
      (s.fatherName || '').toLowerCase().includes(q) ||
      (s.motherName || '').toLowerCase().includes(q) ||
      (s.guardianPhone || '').toLowerCase().includes(q);
    return matchesClass && matchesQ;
  });

  const filteredOverviewStudents = students.filter((s) => {
    const q = overviewStudentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      String(s.rollNumber).includes(q) ||
      (s.fatherName || '').toLowerCase().includes(q) ||
      (s.guardianPhone || '').toLowerCase().includes(q)
    );
  });

  const filteredOverviewMarks = data.recentMarks.filter((m) => {
    const q = overviewMarksSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      m.studentName.toLowerCase().includes(q) ||
      m.studentCode.toLowerCase().includes(q) ||
      String(m.rollNumber).includes(q) ||
      m.subjectName.toLowerCase().includes(q) ||
      m.examName.toLowerCase().includes(q)
    );
  });

  const filteredOverviewAttendance = data.recentAttendance.filter((rec) => {
    const q = overviewAttendanceSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      rec.studentName.toLowerCase().includes(q) ||
      rec.studentCode.toLowerCase().includes(q) ||
      String(rec.rollNumber).includes(q) ||
      rec.date.toLowerCase().includes(q) ||
      rec.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Good Morning, {user?.fullName} 👋
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {homeroomClass
              ? `Assigned Class: ${homeroomClass.name}-${homeroomClass.section} (Room ${homeroomClass.roomNumber || '101'}) · ${students.length} students`
              : `Assigned to ${data.myClasses.length} class(es) · ${data.mySubjects.length} subject allocations`}
          </p>
        </div>

        {/* View Toggle & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mr-1">
            <button
              type="button"
              onClick={() => setViewMode('overview')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                viewMode === 'overview'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('roster')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                viewMode === 'roster'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Class Students ({students.length})
            </button>
          </div>

          <button
            type="button"
            disabled={data.myClasses.length === 0}
            onClick={() => {
              setStudentModalMode('create');
              setEditingStudent(null);
              setStudentModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Student Details
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('marks')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Add Marks
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('teacher-attendance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
          >
            <CalendarCheck className="w-3.5 h-3.5" /> Attendance
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('homework')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5" /> Homework
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('notes')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
          >
            <BookMarked className="w-3.5 h-3.5" /> Notes
          </button>
          <button
            type="button"
            disabled={students.length === 0}
            onClick={() => setRemarkOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold whitespace-nowrap"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" /> Add Remark
          </button>
        </div>
      </div>

      {/* No Class Assigned Notice */}
      {data.myClasses.length === 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-5 text-sm text-amber-900 dark:text-amber-200">
          No class has been assigned to your teacher account yet. Once the school administrator assigns your class in <strong>Classes &amp; Teachers</strong>, your class roster and student detail forms will appear here.
        </div>
      )}

      {/* ROSTER / STUDENT DETAILS VIEW */}
      {viewMode === 'roster' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div>
              <h2 className="text-base font-bold inline-flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[var(--sc-primary)]" />
                My Class Student Roster &amp; Detailed Records
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter and maintain complete student information (DOB, blood group, parents, phone, address, emergency &amp; medical notes) for your assigned class
              </p>
            </div>
            <button
              type="button"
              disabled={data.myClasses.length === 0}
              onClick={() => {
                setStudentModalMode('create');
                setEditingStudent(null);
                setStudentModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" /> Add Student
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="search"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search student name, roll #, ID, parent name, or phone..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm"
              />
            </div>
            {data.myClasses.length > 1 && (
              <select
                value={rosterClassFilter}
                onChange={(e) => setRosterClassFilter(Number(e.target.value))}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                <option value={0}>All My Classes ({students.length})</option>
                {data.myClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}-{c.section}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs font-mono text-slate-500 whitespace-nowrap">
              Showing {filteredRoster.length} of {students.length}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Roll / ID</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">DOB &amp; Blood Group</th>
                    <th className="py-3 px-4">Father / Mother</th>
                    <th className="py-3 px-4">Guardian Phone &amp; Address</th>
                    <th className="py-3 px-4 text-right">Manage Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                        {students.length === 0
                          ? 'No students found in your class yet. Click "Add Student" to enter a student\'s detailed record.'
                          : 'No students match your current search or class filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono text-xs">
                          <div className="font-semibold">Roll #{s.rollNumber}</div>
                          <div className="text-slate-500">{s.studentCode}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{s.fullName}</div>
                          <div className="text-xs text-slate-500">
                            {s.className}-{s.section} · {s.gender || 'Not specified'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div className="font-mono">{s.dateOfBirth || 'DOB missing'}</div>
                          <div className="text-slate-500">
                            Blood: {s.bloodGroup || '—'} {s.houseName ? `· ${s.houseName}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div>F: {s.fatherName || '—'}</div>
                          <div className="text-slate-500">M: {s.motherName || '—'}</div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div className="font-mono">{s.guardianPhone || 'Phone missing'}</div>
                          <div className="text-slate-500 truncate max-w-[220px]">
                            {s.address || 'Address missing'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setOpenedStudent(s)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white hover:opacity-90"
                            >
                              <FolderOpen className="w-3.5 h-3.5" /> Open Student Account
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setStudentModalMode('edit');
                                setEditingStudent(s);
                                setStudentModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Class Students</span>
                <Users className="w-4 h-4 text-[var(--sc-primary)] dark:text-blue-400" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums">
                {data.stats.totalStudents}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Pending Marks</span>
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums">
                {data.stats.pendingMarks}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Active Assignments</span>
                <ClipboardList className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums">
                {data.stats.activeAssignments}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Upcoming Exams</span>
                <CalendarClock className="w-4 h-4 text-red-600" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums">
                {data.stats.upcomingExams}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Active Notices</span>
                <Megaphone className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums">
                {data.stats.activeNotices}
              </div>
            </div>
          </div>

          {/* Assigned Class & Quick Roster Preview */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold">My Assigned Class Roster &amp; Student Accounts</h2>
                <p className="text-xs text-slate-500">
                  Open any student&apos;s account to view &amp; enter marks, attendance, homework, remarks, and complete student details
                </p>
              </div>
              <div className="flex items-center gap-3">
                {students.length > 0 && (
                  <div className="relative w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="search"
                      value={overviewStudentSearch}
                      onChange={(e) => setOverviewStudentSearch(e.target.value)}
                      placeholder="Search student name, roll #..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-2.5 py-1.5 text-xs"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setViewMode('roster')}
                  className="text-xs font-semibold text-[var(--sc-primary)] hover:underline whitespace-nowrap"
                >
                  Open Full Roster
                </button>
              </div>
            </div>
            {students.length === 0 ? (
              <p className="py-4 text-xs text-slate-500 text-center">
                No students in your assigned class yet. Use &ldquo;Add Student Details&rdquo; above to add students.
              </p>
            ) : filteredOverviewStudents.length === 0 ? (
              <p className="py-6 text-xs text-slate-500 text-center">
                No students match &ldquo;{overviewStudentSearch}&rdquo;.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Roll</th>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">School ID &amp; Portal</th>
                      <th className="py-2.5 px-3">Guardian &amp; Phone</th>
                      <th className="py-2.5 px-3 text-right">Student Account &amp; Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {(overviewStudentSearch.trim()
                      ? filteredOverviewStudents.slice(0, 50)
                      : filteredOverviewStudents.slice(0, 12)
                    ).map((s) => (
                      <tr key={s.id}>
                        <td className="py-2.5 px-3 font-mono text-xs">#{s.rollNumber}</td>
                        <td className="py-2.5 px-3 font-medium">
                          {s.fullName}
                          <span className="ml-2 text-xs text-slate-500">
                            {s.className}-{s.section}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs">
                          <span className="text-slate-600 dark:text-slate-300">{s.studentCode}</span>
                          <span
                            className={`ml-2 font-sans text-[11px] font-medium ${
                              s.hasPortalAccount
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {s.hasPortalAccount ? '· Active' : '· Not Set'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-400">
                          {s.fatherName || '—'} {s.guardianPhone ? `· ${s.guardianPhone}` : ''}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setOpenedStudent(s)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white hover:opacity-90"
                            >
                              <FolderOpen className="w-3 h-3" /> Open Student Account
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setStudentModalMode('edit');
                                setEditingStudent(s);
                                setStudentModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="w-3 h-3" /> Edit Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* StudentDashboard-Equivalent Information for Assigned Class */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Student Marks */}
            <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-sm font-semibold inline-flex items-center gap-2">
                    <Award className="w-4 h-4 text-[var(--sc-primary)]" />
                    Student Marks ({homeroomClass ? `${homeroomClass.name}-${homeroomClass.section}` : 'Assigned Class'})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Click any student row to open their account &amp; enter marks
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  {data.recentMarks.length > 0 && (
                    <div className="relative w-44">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="search"
                        value={overviewMarksSearch}
                        onChange={(e) => setOverviewMarksSearch(e.target.value)}
                        placeholder="Search student or subject..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-7 pr-2 py-1 text-xs"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigateTab('marks')}
                    className="text-xs font-semibold text-[var(--sc-primary)] hover:underline whitespace-nowrap"
                  >
                    Bulk Marks
                  </button>
                </div>
              </div>
              {data.recentMarks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No marks recorded for your class yet. Open a student account or use Add Marks to enter scores.
                </div>
              ) : filteredOverviewMarks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No marks match &ldquo;{overviewMarksSearch}&rdquo;.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2 pr-2 font-medium">Student</th>
                        <th className="py-2 px-2 font-medium">Subject</th>
                        <th className="py-2 px-2 font-medium">Exam</th>
                        <th className="py-2 px-2 font-medium text-right">Score</th>
                        <th className="py-2 pl-2 font-medium text-right">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(overviewMarksSearch.trim()
                        ? filteredOverviewMarks.slice(0, 30)
                        : filteredOverviewMarks.slice(0, 8)
                      ).map((m) => {
                        const targetStu = students.find((s) => s.id === m.studentId);
                        return (
                          <tr
                            key={m.id}
                            onClick={() => targetStu && setOpenedStudent(targetStu)}
                            className={targetStu ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40' : ''}
                          >
                            <td className="py-2.5 pr-2 font-medium">
                              #{m.rollNumber} {m.studentName}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">
                              {m.subjectName}
                            </td>
                            <td className="py-2.5 px-2 text-slate-500">{m.examName}</td>
                            <td className="py-2.5 px-2 text-right font-mono font-semibold">
                              {m.obtainedMarks}/{m.maxMarks} ({m.percentage}%)
                            </td>
                            <td className="py-2.5 pl-2 text-right">
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-blue-50 text-[var(--sc-primary)] dark:bg-blue-950/50 dark:text-blue-300 font-semibold">
                                {m.grade}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Upcoming Homework */}
            <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-sm font-semibold inline-flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-600" />
                    Upcoming Homework
                  </h2>
                  <p className="text-xs text-slate-500">Homework visible in student portals</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('homework')}
                  className="text-xs font-semibold text-[var(--sc-primary)] hover:underline"
                >
                  Manage All
                </button>
              </div>
              {data.upcomingHomework.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No homework assigned for your class yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.upcomingHomework.slice(0, 4).map((hw) => (
                    <div
                      key={hw.id}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                          {hw.subjectName}
                        </span>
                        <span className="font-mono text-slate-500">Due {hw.dueDate}</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {hw.title}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{hw.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Recent Attendance Records */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold inline-flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-emerald-600" />
                  Recent Attendance Records
                </h2>
                <p className="text-xs text-slate-500">
                  Class Rate {data.attendanceSummary.percentage}% · Present {data.attendanceSummary.present} ·
                  Late {data.attendanceSummary.late} · Absent {data.attendanceSummary.absent} ·
                  Excused {data.attendanceSummary.excused}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {data.recentAttendance.length > 0 && (
                  <div className="relative w-52">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="search"
                      value={overviewAttendanceSearch}
                      onChange={(e) => setOverviewAttendanceSearch(e.target.value)}
                      placeholder="Search student name or date..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-7 pr-2 py-1 text-xs"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateTab('teacher-attendance')}
                  className="text-xs font-semibold text-[var(--sc-primary)] hover:underline whitespace-nowrap"
                >
                  Open Full Register
                </button>
              </div>
            </div>
            {data.recentAttendance.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No attendance records logged yet. Open a student account or the Attendance register to record daily attendance.
              </div>
            ) : filteredOverviewAttendance.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No attendance records match &ldquo;{overviewAttendanceSearch}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(overviewAttendanceSearch.trim()
                  ? filteredOverviewAttendance.slice(0, 30)
                  : filteredOverviewAttendance.slice(0, 9)
                ).map((rec) => {
                  const targetStu = students.find((s) => s.id === rec.studentId);
                  return (
                    <div
                      key={rec.id}
                      onClick={() => targetStu && setOpenedStudent(targetStu)}
                      className={`rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-2 text-xs ${
                        targetStu ? 'cursor-pointer hover:border-[var(--sc-primary)]' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          #{rec.rollNumber} {rec.studentName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">{rec.date}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold text-[11px] shrink-0 ${
                          rec.status === 'PRESENT'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : rec.status === 'LATE'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : rec.status === 'ABSENT'
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h2 className="text-sm font-semibold mb-4">Class Performance Overview (%)</h2>
              <div className="h-60 w-full">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No exam marks recorded yet for your classes.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="Average" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h2 className="text-sm font-semibold mb-4">My Assigned Classes &amp; Subjects</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.myClasses.map((mc) => (
                  <div
                    key={`cls-${mc.id}`}
                    className="py-2.5 flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="font-semibold">
                        {mc.name}-{mc.section}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        Room {mc.roomNumber || '101'} · {mc.studentCount || 0} students
                      </span>
                    </div>
                    {mc.isClassTeacher && (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        Class Teacher
                      </span>
                    )}
                  </div>
                ))}
                {data.mySubjects.map((ms, idx) => (
                  <div
                    key={`${ms.classId}-${ms.subjectId}-${idx}`}
                    className="py-2.5 flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">
                      {ms.className}-{ms.section}
                    </span>
                    <span className="text-xs font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                      {ms.subjectName}
                    </span>
                  </div>
                ))}
                {data.myClasses.length === 0 && data.mySubjects.length === 0 && (
                  <p className="py-4 text-xs text-slate-500">No class allocations yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h2 className="text-sm font-semibold mb-3">Class Actions &amp; Checklist</h2>
              <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span>
                    Complete detailed profiles for{' '}
                    {homeroomClass ? `${homeroomClass.name}-${homeroomClass.section}` : 'your class'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewMode('roster')}
                    className="text-xs font-semibold text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
                  >
                    Manage Roster
                  </button>
                </li>
                <li className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span>
                    Record daily attendance for{' '}
                    {homeroomClass ? `${homeroomClass.name}-${homeroomClass.section}` : 'assigned class'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('teacher-attendance')}
                    className="text-xs font-semibold text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
                  >
                    Open Register
                  </button>
                </li>
                <li className="flex items-center justify-between py-1.5">
                  <span>Enter or upload marks ({data.stats.pendingMarks} pending exam(s))</span>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('marks')}
                    className="text-xs font-semibold text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
                  >
                    Enter Marks
                  </button>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h2 className="text-sm font-semibold mb-3">Recent Activity</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentActivity.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">No recent activity yet.</p>
                ) : (
                  data.recentActivity.slice(0, 5).map((log) => (
                    <div key={log.id} className="py-2 text-xs space-y-0.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {log.details}
                      </div>
                      <div className="text-slate-500 font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Full Student Details Modal */}
      <StudentDetailsModal
        open={studentModalOpen}
        mode={studentModalMode}
        role="TEACHER"
        student={editingStudent}
        classes={data.myClasses}
        defaultClassId={homeroomClass?.id}
        onClose={() => {
          setStudentModalOpen(false);
          setEditingStudent(null);
        }}
        onSave={handleSaveStudent}
      />

      {/* Add Teacher Remark Modal */}
      {remarkOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-base font-semibold">Add Private Academic Remark</h3>
            <form onSubmit={handleAddRemark} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Student
                </label>
                <select
                  value={remarkStudentId}
                  onChange={(e) => setRemarkStudentId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.className}-{s.section} · #{s.rollNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={remarkSubjectId}
                  onChange={(e) => setRemarkSubjectId(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  {data.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
                <select
                  value={remarkCategory}
                  onChange={(e) =>
                    setRemarkCategory(
                      e.target.value as 'ACADEMIC' | 'BEHAVIOR' | 'PROGRESS'
                    )
                  }
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="PROGRESS">Progress</option>
                  <option value="ACADEMIC">Academic</option>
                  <option value="BEHAVIOR">Behavior</option>
                </select>
              </div>
              <textarea
                rows={3}
                required
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                placeholder="Write academic or behavioral feedback for parent..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRemarkOpen(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--sc-primary)] text-white"
                >
                  Save Remark
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
