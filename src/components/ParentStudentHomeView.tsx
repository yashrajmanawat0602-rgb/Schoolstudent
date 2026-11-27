import React from 'react';
import {
  ArrowRight,
  Award,
  BookMarked,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  Image as ImageIcon,
  Lightbulb,
  Megaphone,
  MessageSquareQuote,
  UserCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { downloadProtectedFile } from '../services/api.ts';
import { NoticeItem, StudentOverviewResponse } from '../types/index.ts';
import { FirestoreNotesCard } from './FirestoreNotesCard.tsx';
import { StudentActivitiesSection } from './StudentActivitiesSection.tsx';

function getGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good Morning';
  if (hr < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export const ParentStudentHomeView: React.FC<{
  overview: StudentOverviewResponse;
  notices: NoticeItem[];
  onNavigateTab: (tab: string) => void;
}> = ({ overview, notices, onNavigateTab }) => {
  const { user, children, selectedChild, setSelectedChildId } = useAuth();
  const isParent = user?.role === 'PARENT';

  const latestMarks = overview.marks.slice(0, 4);
  const overallAvg =
    latestMarks.length > 0
      ? Math.round(
          (latestMarks.reduce((acc, m) => acc + m.percentage, 0) /
            latestMarks.length) *
            10
        ) / 10
      : 0;

  const pinnedOrTopNotices = notices.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Greeting & Child Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {getGreeting()}, {user?.fullName} 👋
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isParent
              ? `Viewing academic overview for ${overview.student.fullName} · ${overview.student.className}-${overview.student.section}`
              : `${overview.student.className}-${overview.student.section} · Roll #${overview.student.rollNumber} · Student ID ${overview.student.studentCode}`}
          </p>
        </div>

        {isParent && children.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
            {children.map((child) => {
              const active = selectedChild?.id === child.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setSelectedChildId(child.id)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {child.fullName} · {child.className}-{child.section}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Smart Performance Insights Strip */}
      {overview.insights.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5 flex flex-col md:flex-row md:items-center gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 shrink-0">
            <Lightbulb className="w-4 h-4" />
            Key Insights
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            {overview.insights.map((ins, idx) => (
              <span key={idx} className="inline-flex items-center gap-2">
                {idx > 0 && <span aria-hidden="true" className="text-slate-300">·</span>}
                <span>{ins}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('academics')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-[var(--sc-primary)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Academic Performance</span>
            <Award className="w-4 h-4 text-[var(--sc-primary)] dark:text-blue-400" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums">
            {overallAvg}%
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>Latest exam average</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('attendance')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-[var(--sc-primary)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Attendance</span>
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums">
            {overview.attendance.summary.percentage}%
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>
              {overview.attendance.summary.present + overview.attendance.summary.late}/
              {overview.attendance.summary.totalSchoolDays} school days
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('homework')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-[var(--sc-primary)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Homework &amp; Tasks</span>
            <BookOpen className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums">
            {overview.homework.length + overview.assignments.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>
              {overview.homework.length} homework · {overview.assignments.length} assignments
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('exams')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-[var(--sc-primary)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Upcoming Exams</span>
            <CalendarClock className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums">
            {overview.upcomingExams.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>
              {overview.upcomingExams[0]
                ? `Next: ${overview.upcomingExams[0].examDate}`
                : 'No exams scheduled'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* MVA Quick Modules Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('timetable')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 hover:border-[var(--sc-primary)] transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Class Timetable
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Mon–Sat daily periods &amp; faculty
            </div>
          </div>
          <Clock className="w-5 h-5 text-[var(--sc-primary)] dark:text-blue-400" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('fees')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 hover:border-[var(--sc-primary)] transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Fee Status &amp; Receipts
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Tuition, transport &amp; lab statements
            </div>
          </div>
          <CreditCard className="w-5 h-5 text-emerald-600" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('gallery')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 hover:border-[var(--sc-primary)] transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Campus Media Gallery
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Science fair, sports &amp; campus photos
            </div>
          </div>
          <ImageIcon className="w-5 h-5 text-amber-600" />
        </button>
      </div>

      {/* Priority Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Marks */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Latest Marks
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('academics')}
              className="text-xs font-medium text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
            >
              View Full Report
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {latestMarks.map((m) => (
              <div
                key={m.id}
                className="py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {m.subjectName}
                  </div>
                  <div className="text-xs text-slate-500">{m.examName}</div>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {m.obtainedMarks}/{m.maxMarks}
                  </span>
                  <span className="ml-2 text-xs font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                    {m.grade}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Today's Homework */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Active Homework
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('homework')}
              className="text-xs font-medium text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
            >
              View All
            </button>
          </div>
          {overview.homework.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No active homework.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {overview.homework.slice(0, 4).map((hw) => (
                <div key={hw.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                      {hw.subjectName}
                    </span>
                    <span className="font-mono">Due {hw.dueDate}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {hw.title}
                  </div>
                  {hw.attachmentUrl && hw.attachmentName && (
                    <button
                      type="button"
                      onClick={() =>
                        void downloadProtectedFile(hw.attachmentUrl!, hw.attachmentName!).catch(
                          () => undefined
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
                    >
                      <Download className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[220px]">{hw.attachmentName}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Important Notices */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-slate-500" />
              Important Notices
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('notices')}
              className="text-xs font-medium text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
            >
              Notice Board
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pinnedOrTopNotices.map((n) => (
              <div key={n.id} className="py-2.5 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    {n.category}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{n.priority}</span>
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {n.title}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Teacher Remarks & Study Shortcuts */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2">
              <MessageSquareQuote className="w-4 h-4 text-slate-500" />
              Recent Teacher Remarks
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('notes')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
            >
              <BookMarked className="w-3.5 h-3.5" /> Study Library
            </button>
          </div>
          {overview.remarks.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              No teacher remarks recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {overview.remarks.slice(0, 3).map((r) => (
                <div key={r.id} className="py-2.5 space-y-1">
                  <div className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {r.teacherName}
                    </span>
                    {r.subjectName && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>{r.subjectName}</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    “{r.remark}”
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <FirestoreNotesCard />
    </div>
  );
};

export const StudentProfileView: React.FC<{
  overview: StudentOverviewResponse;
}> = ({ overview }) => {
  const { schoolSettings } = useAuth();
  const stu = overview.student;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Student Academic Profile
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Verified academic enrollment and faculty directory
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {stu.avatarUrl ? (
          <img
            src={stu.avatarUrl}
            alt={stu.fullName}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
            <UserCircle2 className="w-10 h-10" />
          </div>
        )}

        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {stu.fullName}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-mono">{stu.studentCode}</span>
            <span aria-hidden="true">·</span>
            <span>
              {stu.className} — Section {stu.section}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Roll #{stu.rollNumber}</span>
            <span aria-hidden="true">·</span>
            <span>Academic Year {schoolSettings?.currentAcademicYear || '2026-2027'}</span>
          </div>
          <p className="text-xs text-slate-500">
            Homeroom {stu.roomNumber || 'Main Block'} · Admission Date {stu.admissionDate}
          </p>
        </div>
      </div>

      {/* Detailed Student Profile Record */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="text-sm font-semibold mb-4">Personal, Family &amp; Contact Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-slate-500">Date of Birth</div>
            <div className="font-mono font-medium mt-0.5">{stu.dateOfBirth || 'Not recorded'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Gender &amp; Blood Group</div>
            <div className="font-medium mt-0.5">
              {stu.gender || 'Not specified'}
              {stu.bloodGroup ? ` · ${stu.bloodGroup}` : ''}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">School House</div>
            <div className="font-medium mt-0.5">{stu.houseName || 'Not assigned'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Father&apos;s Name</div>
            <div className="font-medium mt-0.5">{stu.fatherName || 'Not recorded'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Mother&apos;s Name</div>
            <div className="font-medium mt-0.5">{stu.motherName || 'Not recorded'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Guardian Phone</div>
            <div className="font-mono font-medium mt-0.5">{stu.guardianPhone || 'Not recorded'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Emergency Contact</div>
            <div className="font-medium mt-0.5">{stu.emergencyContact || 'Not recorded'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Previous School</div>
            <div className="font-medium mt-0.5">{stu.previousSchool || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Guardian Contact Email</div>
            <div className="font-medium mt-0.5">{stu.guardianEmail || '—'}</div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="text-xs text-slate-500">Residential Address</div>
            <div className="font-medium mt-0.5">{stu.address || 'Not recorded'}</div>
          </div>
          {stu.medicalNotes && (
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3">
              <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Medical / Health Notes
              </div>
              <div className="text-sm text-amber-900 dark:text-amber-200 mt-0.5">
                {stu.medicalNotes}
              </div>
            </div>
          )}
        </div>
      </div>

      <StudentActivitiesSection
        studentId={stu.id}
        studentName={stu.fullName}
        activities={overview.activities || []}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="text-sm font-semibold mb-4 inline-flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-500" />
            Enrolled Subjects &amp; Teachers
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {overview.subjects.map((sub) => (
              <div
                key={sub.subjectId}
                className="py-2.5 flex items-center justify-between text-sm"
              >
                <div>
                  <div className="font-medium">{sub.subjectName}</div>
                  <div className="text-xs font-mono text-slate-500">
                    {sub.subjectCode}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-600 dark:text-slate-400">
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    {sub.teacherName}
                  </div>
                  <div className="font-mono">{sub.teacherUsername || 'Faculty'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="text-sm font-semibold mb-4 inline-flex items-center gap-2">
            <MessageSquareQuote className="w-4 h-4 text-slate-500" />
            All Teacher Remarks
          </h3>
          {overview.remarks.length === 0 ? (
            <p className="text-sm text-slate-500">No remarks recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {overview.remarks.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {r.teacherName} · {r.subjectName || r.category}
                    </span>
                    <span className="font-mono">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {r.remark}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
