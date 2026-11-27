import React, { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  Bell,
  BookMarked,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Clock,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Moon,
  Palette,
  Search,
  Sparkles,
  Sun,
  UserCircle2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import {
  setCurrentPageContext,
  subscribeNavigateAction,
} from '../services/assistantBus.ts';
import {
  NoticeItem,
  NotificationItem,
  StudentOverviewResponse,
  ThemeMode,
} from '../types/index.ts';
import { AcademicPerformanceView } from '../components/AcademicPerformanceView.tsx';
import { AdminDashboardView } from '../components/AdminDashboardView.tsx';
import { AttendanceCalendarView } from '../components/AttendanceCalendarView.tsx';
import { FirestoreNotesCard } from '../components/FirestoreNotesCard.tsx';
import { HomeworkAndAssignmentsView } from '../components/HomeworkAndAssignmentsView.tsx';
import { MessagesView, NotificationsView } from '../components/MessagesAndNotificationsView.tsx';
import { NotesLibraryView } from '../components/NotesLibraryView.tsx';
import { ExamTimetableView, NoticesBoardView } from '../components/NoticesAndExamsView.tsx';
import {
  ParentStudentHomeView,
  StudentProfileView,
} from '../components/ParentStudentHomeView.tsx';
import { SchoolCalendarView } from '../components/SchoolCalendarView.tsx';
import { StudentDashboard } from '../components/StudentDashboard.tsx';
import { TeacherAttendanceView } from '../components/TeacherAttendanceView.tsx';
import { TeacherDashboardView } from '../components/TeacherDashboardView.tsx';
import { TeacherMarksView } from '../components/TeacherMarksView.tsx';
import {
  CampusGalleryView,
  ClassTimetableView,
  FeeManagementView,
} from '../components/MvaFeaturesViews.tsx';
import {
  DashboardSkeleton,
  EmptyState,
  FriendlyErrorView,
} from '../components/ui/ToastAndModal.tsx';

interface SearchResults {
  notes: Array<{ id: number; title: string; subjectName: string }>;
  homework: Array<{ id: number; title: string; subjectName: string }>;
  assignments: Array<{ id: number; title: string; subjectName: string }>;
  notices: Array<{ id: number; title: string; category: string }>;
  exams: Array<{ id: number; name: string; examDate: string }>;
  students: Array<{ id: number; studentCode: string; fullName: string; className: string; section: string }>;
}

export const DashboardLayout: React.FC = () => {
  const {
    user,
    selectedChild,
    studentProfile,
    schoolSettings,
    logout,
    themeMode,
    setThemeMode,
  } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiCommand, setAiCommand] = useState<{
    tabId: string;
    query?: string;
    roleFilter?: 'ALL' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';
    nonce: number;
  } | null>(null);

  const [studentOverview, setStudentOverview] =
    useState<StudentOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<{
    status?: number;
    message: string;
  } | null>(null);

  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Global search
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const activeStudentId =
    user?.role === 'PARENT'
      ? selectedChild?.id || null
      : user?.role === 'STUDENT'
        ? studentProfile?.id || null
        : null;

  const activeClassId =
    user?.role === 'PARENT'
      ? selectedChild?.classId
      : user?.role === 'STUDENT'
        ? studentProfile?.classId
        : undefined;

  const loadNotifications = async () => {
    try {
      const [notifRows, noticeRows] = await Promise.all([
        apiFetch<NotificationItem[]>('/api/notifications'),
        apiFetch<NoticeItem[]>('/api/notices'),
      ]);
      setNotifications(notifRows);
      setNotices(noticeRows);
    } catch {
      // Ignore silent refresh error
    }
  };

  const loadStudentOverview = async (stuId: number) => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await apiFetch<StudentOverviewResponse>(
        `/api/students/${stuId}/overview`
      );
      setStudentOverview(data);
    } catch (err: any) {
      setOverviewError({
        status: err?.status,
        message: err?.message || 'Unable to load student academic record.',
      });
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  useEffect(() => {
    if (activeStudentId) {
      loadStudentOverview(activeStudentId);
    }
  }, [activeStudentId]);

  useEffect(() => {
    const label = navItems.find((n) => n.id === activeTab)?.label || activeTab;
    setCurrentPageContext(`${user?.role || 'PORTAL'}:${activeTab} (${label})`);
  }, [activeTab, user?.role]);

  useEffect(() => {
    return subscribeNavigateAction((action) => {
      setActiveTab(action.tabId);
      setMobileMenuOpen(false);
      setSearchFocused(false);
      setAiCommand({
        tabId: action.tabId,
        query: action.searchQuery,
        roleFilter: action.roleFilter,
        nonce: action.nonce || Date.now(),
      });
    });
  }, []);

  useEffect(() => {
    const q = searchTerm.trim();
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`)
        .then(setSearchResults)
        .catch(() => setSearchResults(null));
    }, 220);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navItems: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> =
    user?.role === 'ADMIN'
      ? [
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'classes', label: 'Classes & Teachers', icon: Building2 },
          { id: 'students', label: 'Student Enrollment', icon: GraduationCap },
          { id: 'parents', label: 'Parent Enrollment', icon: UserPlus },
          { id: 'users', label: 'Faculty & Accounts', icon: Users },
          { id: 'activity', label: 'Activity Logs', icon: Activity },
          { id: 'timetable', label: 'Class Timetable', icon: Clock },
          { id: 'fees', label: 'Fee Management', icon: CreditCard },
          { id: 'notices', label: 'Notice Board', icon: Megaphone },
          { id: 'gallery', label: 'Campus Gallery', icon: ImageIcon },
          { id: 'calendar', label: 'School Calendar', icon: CalendarDays },
          { id: 'branding', label: 'School Branding', icon: Palette },
        ]
      : user?.role === 'TEACHER'
        ? [
            { id: 'overview', label: 'Teacher Home', icon: LayoutDashboard },
            { id: 'class-students', label: 'Class Students', icon: GraduationCap },
            { id: 'marks', label: 'Marks & CSV', icon: FileSpreadsheet },
            { id: 'teacher-attendance', label: 'Attendance', icon: CalendarCheck },
            { id: 'timetable', label: 'Class Timetable', icon: Clock },
            { id: 'homework', label: 'Homework', icon: BookOpen },
            { id: 'notes', label: 'Notes Library', icon: BookMarked },
            { id: 'exams', label: 'Exam Timetable', icon: CalendarClock },
            { id: 'notices', label: 'Notice Board', icon: Megaphone },
            { id: 'gallery', label: 'Campus Gallery', icon: ImageIcon },
            { id: 'calendar', label: 'School Calendar', icon: CalendarDays },
            { id: 'messages', label: 'Parent Messages', icon: Mail },
          ]
        : [
            { id: 'overview', label: 'Home', icon: Home },
            { id: 'academics', label: 'Performance', icon: Award },
            { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
            { id: 'timetable', label: 'Class Timetable', icon: Clock },
            { id: 'homework', label: 'Homework', icon: BookOpen },
            { id: 'notes', label: 'Notes Library', icon: BookMarked },
            { id: 'exams', label: 'Exam Timetable', icon: CalendarClock },
            { id: 'fees', label: 'Fee Status', icon: CreditCard },
            { id: 'notices', label: 'Notice Board', icon: Megaphone },
            { id: 'gallery', label: 'Campus Gallery', icon: ImageIcon },
            { id: 'calendar', label: 'School Calendar', icon: CalendarDays },
            ...(user?.role === 'PARENT'
              ? [{ id: 'messages', label: 'Messages', icon: Mail }]
              : []),
            { id: 'profile', label: 'Student Profile', icon: UserCircle2 },
          ];

  const cycleTheme = () => {
    const order: ThemeMode[] = ['light', 'dark', 'school'];
    const idx = order.indexOf(themeMode);
    setThemeMode(order[(idx + 1) % order.length]);
  };

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setSearchFocused(false);
  };

  const renderMainContent = () => {
    if (activeTab === 'notifications') {
      return (
        <NotificationsView
          notifications={notifications}
          onRefresh={loadNotifications}
          onNavigateTab={handleNavigate}
        />
      );
    }

    if (user?.role === 'ADMIN') {
      if (
        activeTab === 'overview' ||
        activeTab === 'classes' ||
        activeTab === 'students' ||
        activeTab === 'parents' ||
        activeTab === 'users' ||
        activeTab === 'activity' ||
        activeTab === 'branding'
      ) {
        return (
          <AdminDashboardView
            initialSection={activeTab}
            aiCommand={
              aiCommand && aiCommand.tabId === activeTab
                ? {
                    section: activeTab,
                    query: aiCommand.query,
                    roleFilter: aiCommand.roleFilter,
                    nonce: aiCommand.nonce,
                  }
                : null
            }
          />
        );
      }
      if (activeTab === 'timetable') return <ClassTimetableView />;
      if (activeTab === 'fees') return <FeeManagementView />;
      if (activeTab === 'gallery') return <CampusGalleryView />;
      if (activeTab === 'homework') return <HomeworkAndAssignmentsView />;
      if (activeTab === 'notes') {
        return (
          <NotesLibraryView
            aiCommand={aiCommand && aiCommand.tabId === 'notes' ? aiCommand : null}
          />
        );
      }
      if (activeTab === 'exams') return <ExamTimetableView />;
      if (activeTab === 'notices') return <NoticesBoardView />;
      if (activeTab === 'calendar') return <SchoolCalendarView />;
      if (activeTab === 'messages') return <MessagesView />;
    }

    if (user?.role === 'TEACHER') {
      if (activeTab === 'overview')
        return (
          <TeacherDashboardView
            initialView="overview"
            onNavigateTab={handleNavigate}
            aiCommand={aiCommand && aiCommand.tabId === 'overview' ? aiCommand : null}
          />
        );
      if (activeTab === 'class-students')
        return (
          <TeacherDashboardView
            initialView="roster"
            onNavigateTab={handleNavigate}
            aiCommand={aiCommand && aiCommand.tabId === 'class-students' ? aiCommand : null}
          />
        );
      if (activeTab === 'marks') return <TeacherMarksView />;
      if (activeTab === 'teacher-attendance') return <TeacherAttendanceView />;
      if (activeTab === 'timetable') return <ClassTimetableView />;
      if (activeTab === 'homework') return <HomeworkAndAssignmentsView />;
      if (activeTab === 'notes') {
        return (
          <NotesLibraryView
            aiCommand={aiCommand && aiCommand.tabId === 'notes' ? aiCommand : null}
          />
        );
      }
      if (activeTab === 'exams') return <ExamTimetableView />;
      if (activeTab === 'notices') return <NoticesBoardView />;
      if (activeTab === 'gallery') return <CampusGalleryView />;
      if (activeTab === 'calendar') return <SchoolCalendarView />;
      if (activeTab === 'messages') return <MessagesView />;
    }

    // PARENT & STUDENT views
    if (activeTab === 'timetable')
      return <ClassTimetableView classIdFilter={activeClassId} />;
    if (activeTab === 'fees')
      return <FeeManagementView studentId={activeStudentId} />;
    if (activeTab === 'gallery') return <CampusGalleryView />;
    if (activeTab === 'homework')
      return <HomeworkAndAssignmentsView classIdFilter={activeClassId} />;
    if (activeTab === 'notes')
      return (
        <NotesLibraryView
          classIdFilter={activeClassId}
          aiCommand={aiCommand && aiCommand.tabId === 'notes' ? aiCommand : null}
        />
      );
    if (activeTab === 'exams') return <ExamTimetableView />;
    if (activeTab === 'notices') return <NoticesBoardView />;
    if (activeTab === 'calendar') return <SchoolCalendarView />;
    if (activeTab === 'messages') return <MessagesView />;

    if (user?.role === 'STUDENT' && activeTab === 'overview') {
      return (
        <StudentDashboard
          studentId={activeStudentId}
          onNavigateTab={handleNavigate}
        />
      );
    }

    if (!activeStudentId) {
      return (
        <div className="space-y-6">
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="No student linked to this account yet"
            description="Ask your school administrator to connect your parent account to your child’s enrollment record."
          />
          <FirestoreNotesCard />
        </div>
      );
    }

    if (overviewLoading) return <DashboardSkeleton />;
    if (overviewError) {
      return (
        <FriendlyErrorView
          status={overviewError.status}
          message={overviewError.message}
          onRetry={() => loadStudentOverview(activeStudentId)}
        />
      );
    }
    if (!studentOverview) return <DashboardSkeleton />;

    if (activeTab === 'academics')
      return <AcademicPerformanceView overview={studentOverview} />;
    if (activeTab === 'attendance')
      return <AttendanceCalendarView overview={studentOverview} />;
    if (activeTab === 'profile')
      return <StudentProfileView overview={studentOverview} />;

    return (
      <ParentStudentHomeView
        overview={studentOverview}
        notices={notices}
        onNavigateTab={handleNavigate}
      />
    );
  };

  return (
    <div className="min-h-screen flex bg-[var(--sc-canvas)] text-[var(--sc-text)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-[var(--sc-surface)]">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <img
            src={
              schoolSettings?.logoUrl ||
              '/assets/aistudio/Screenshot_2026-11-21_at_5.47.20_PM_a4b44a58.png'
            }
            alt="Macro Vision Academy Burhanpur logo"
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
          />
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight truncate">
              {schoolSettings?.schoolName || 'Macro Vision Academy Burhanpur'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              School &amp; Parent Portal
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[var(--sc-primary)] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <UserCircle2 className="w-5 h-5 text-slate-500" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate">{user?.fullName}</div>
              <div className="text-[11px] text-slate-500 truncate font-mono">
                {user?.role} · {user?.username || user?.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-[var(--sc-surface)] h-full flex flex-col p-4 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-sm truncate">
                {schoolSettings?.schoolName || 'Macro Vision Academy Burhanpur'}
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      active
                        ? 'bg-[var(--sc-primary)] text-white'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={logout}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-14 md:h-16 border-b border-slate-200 dark:border-slate-800 bg-[var(--sc-surface)]/95 backdrop-blur px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {navItems.find((n) => n.id === activeTab)?.label || 'Notifications'}
            </span>
          </div>

          {/* Global Search */}
          <div className="relative flex-1 max-w-md hidden sm:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={searchTerm}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search notes, homework, notices, exams..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--sc-primary)]"
            />
            {searchFocused && searchResults && (
              <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 space-y-2.5 z-50 max-h-80 overflow-y-auto text-xs">
                {searchResults.students.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-400 mb-1">Students</div>
                    {searchResults.students.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={() => handleNavigate(user?.role === 'ADMIN' ? 'students' : 'marks')}
                        className="w-full text-left py-1.5 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                      >
                        <span>{s.fullName}</span>
                        <span className="font-mono text-slate-500">
                          {s.studentCode} · {s.className}-{s.section}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.notes.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-400 mb-1">Study Notes</div>
                    {searchResults.notes.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onMouseDown={() => handleNavigate('notes')}
                        className="w-full text-left py-1.5 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 block truncate"
                      >
                        {n.title} · {n.subjectName}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.homework.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-400 mb-1">Homework</div>
                    {searchResults.homework.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onMouseDown={() => handleNavigate('homework')}
                        className="w-full text-left py-1.5 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 block truncate"
                      >
                        {h.title} · {h.subjectName}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.notices.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-400 mb-1">Notices</div>
                    {searchResults.notices.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onMouseDown={() => handleNavigate('notices')}
                        className="w-full text-left py-1.5 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 block truncate"
                      >
                        {n.title}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.notes.length === 0 &&
                  searchResults.homework.length === 0 &&
                  searchResults.notices.length === 0 &&
                  searchResults.students.length === 0 && (
                    <div className="text-slate-500 py-2 text-center">
                      No matching records found.
                    </div>
                  )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={cycleTheme}
              title={`Theme: ${themeMode}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {themeMode === 'dark' ? (
                <Moon className="w-3.5 h-3.5" />
              ) : themeMode === 'school' ? (
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Sun className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline capitalize">{themeMode}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('notifications')}
              aria-label="Open notifications"
              className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          {renderMainContent()}
        </main>
      </div>

      {/* Mobile Bottom Navigation (5 compact tabs: Home, Academics, Homework, Notifications, Profile) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-14 border-t border-slate-200 dark:border-slate-800 bg-[var(--sc-surface)] flex items-center justify-around px-1"
      >
        {[
          { id: 'overview', label: 'Home', icon: Home },
          {
            id:
              user?.role === 'TEACHER'
                ? 'class-students'
                : user?.role === 'ADMIN'
                  ? 'students'
                  : 'academics',
            label:
              user?.role === 'TEACHER'
                ? 'Students'
                : user?.role === 'ADMIN'
                  ? 'Students'
                  : 'Academics',
            icon: Award,
          },
          { id: 'homework', label: 'Homework', icon: BookOpen },
          { id: 'notifications', label: 'Alerts', icon: Bell, badge: unreadCount },
          {
            id:
              user?.role === 'PARENT' || user?.role === 'STUDENT'
                ? 'profile'
                : 'notices',
            label:
              user?.role === 'PARENT' || user?.role === 'STUDENT'
                ? 'Profile'
                : 'Notices',
            icon: UserCircle2,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id + tab.label}
              type="button"
              onClick={() => handleNavigate(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-2 text-[11px] font-medium ${
                active
                  ? 'text-[var(--sc-primary)] dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="mt-0.5">{tab.label}</span>
              {tab.badge ? (
                <span className="absolute top-0.5 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-mono flex items-center justify-center">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
