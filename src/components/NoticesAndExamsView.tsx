import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Megaphone,
  Pin,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import { ExamItem, NoticeItem } from '../types/index.ts';
import { EmptyState, useToast } from './ui/ToastAndModal.tsx';

export const NoticesBoardView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('ALL');
  const [noticeSearch, setNoticeSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('ANNOUNCEMENT');
  const [priority, setPriority] = useState('NORMAL');
  const [targetRole, setTargetRole] = useState('ALL');
  const [isPinned, setIsPinned] = useState(false);

  const canPublish = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  const loadNotices = async () => {
    setLoading(true);
    try {
      const rows = await apiFetch<NoticeItem[]>('/api/notices');
      setNotices(rows);
    } catch (err: any) {
      showToast('Failed to load notices', err?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/teacher/notices', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          category,
          priority,
          targetRole,
          isPinned,
          notifyUsers: true,
        }),
      });
      showToast('Notice Published', 'Targeted recipients have been notified.');
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      loadNotices();
    } catch (err: any) {
      showToast('Publish Failed', err?.message, 'error');
    }
  };

  const togglePin = async (notice: NoticeItem) => {
    try {
      await apiFetch(`/api/admin/notices/${notice.id}/pin`, {
        method: 'PATCH',
        body: JSON.stringify({ isPinned: !notice.isPinned }),
      });
      loadNotices();
    } catch (err: any) {
      showToast('Action failed', err?.message, 'error');
    }
  };

  const deleteNotice = async (id: number) => {
    try {
      await apiFetch(`/api/admin/notices/${id}`, { method: 'DELETE' });
      showToast('Notice removed');
      loadNotices();
    } catch (err: any) {
      showToast('Delete failed', err?.message, 'error');
    }
  };

  const categories = ['ALL', 'PTM', 'EXAM', 'ANNOUNCEMENT', 'EVENT', 'HOLIDAY', 'EMERGENCY'];
  const nq = noticeSearch.trim().toLowerCase();
  const filtered = notices.filter((n) => {
    const matchesCat = catFilter === 'ALL' || n.category === catFilter;
    const matchesSearch =
      !nq ||
      n.title.toLowerCase().includes(nq) ||
      n.description.toLowerCase().includes(nq) ||
      n.authorName.toLowerCase().includes(nq) ||
      n.category.toLowerCase().includes(nq);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            School Notice Board
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Official school circulars, exam alerts, PTM schedules, and campus updates
          </p>
        </div>

        {canPublish && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white hover:opacity-90 self-start whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Publish Notice
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                catFilter === c
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {c === 'ALL' ? 'All Notices' : c}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="search"
            value={noticeSearch}
            onChange={(e) => setNoticeSearch(e.target.value)}
            placeholder="Search notices, author, or topic..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="w-6 h-6" />}
          title="No notices in this category"
          description="Official school circulars and announcements will appear here."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((n) => (
            <article
              key={n.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {n.isPinned && (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                        <Pin className="w-3.5 h-3.5" /> Pinned
                      </span>
                    )}
                    {n.isPinned && <span aria-hidden="true">·</span>}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {n.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    {n.priority !== 'NORMAL' && (
                      <>
                        <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                          <AlertCircle className="w-3.5 h-3.5" /> {n.priority}
                        </span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span className="font-mono">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>By {n.authorName}</span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {n.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {n.description}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePin(n)}
                      title={n.isPinned ? 'Unpin notice' : 'Pin notice'}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNotice(n.id)}
                      title="Delete notice"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-base font-semibold">Publish School Notice</h3>
            <form onSubmit={handlePublish} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm"
                  >
                    <option value="ANNOUNCEMENT">Announcement</option>
                    <option value="PTM">PTM</option>
                    <option value="EXAM">Exam</option>
                    <option value="HOLIDAY">Holiday</option>
                    <option value="EVENT">Event</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="IMPORTANT">Important</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Audience
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm"
                  >
                    <option value="ALL">All Users</option>
                    <option value="PARENT">Parents</option>
                    <option value="STUDENT">Students</option>
                    <option value="TEACHER">Teachers</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
                Pin this notice to the top of the Notice Board
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--sc-primary)] text-white"
                >
                  Publish &amp; Notify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const ExamTimetableView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [examSearch, setExamSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [classesOptions, setClassesOptions] = useState<Array<{ id: number; name: string; section: string }>>([]);
  const [subjectsOptions, setSubjectsOptions] = useState<Array<{ id: number; name: string }>>([]);

  const [name, setName] = useState('');
  const [examGroup, setExamGroup] = useState('Term 2 Assessments (Nov-Dec 2026)');
  const [classId, setClassId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [examDate, setExamDate] = useState('2026-12-08');
  const [startTime, setStartTime] = useState('09:00 AM');
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [room, setRoom] = useState('Main Exam Hall');

  const canAdd = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const loadExams = async () => {
    setLoading(true);
    try {
      const rows = await apiFetch<ExamItem[]>('/api/exams');
      setExams(rows);
      if (canAdd) {
        const td = await apiFetch<{
          myClasses: Array<{ id: number; name: string; section: string }>;
          subjects: Array<{ id: number; name: string }>;
        }>('/api/teacher/dashboard');
        setClassesOptions(td.myClasses);
        setSubjectsOptions(td.subjects);
      }
    } catch (err: any) {
      showToast('Failed to load exams', err?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/teacher/exams', {
        method: 'POST',
        body: JSON.stringify({
          name,
          examGroup,
          classId: classId ? Number(classId) : null,
          subjectId: subjectId ? Number(subjectId) : null,
          examDate,
          startTime,
          durationMinutes: Number(durationMinutes),
          room,
        }),
      });
      showToast('Exam Scheduled', 'Added to exam timetable and school calendar.');
      setCreateOpen(false);
      setName('');
      loadExams();
    } catch (err: any) {
      showToast('Failed to schedule exam', err?.message, 'error');
    }
  };

  const eq = examSearch.trim().toLowerCase();
  const filteredExams = exams.filter((ex) => {
    if (!eq) return true;
    const clsLabel = ex.className ? `${ex.className}-${ex.section}` : 'All Classes';
    return (
      ex.name.toLowerCase().includes(eq) ||
      (ex.subjectName || '').toLowerCase().includes(eq) ||
      clsLabel.toLowerCase().includes(eq) ||
      ex.examDate.toLowerCase().includes(eq) ||
      (ex.room || '').toLowerCase().includes(eq)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Exam Timetable
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Upcoming examination dates, reporting times, durations, and hall assignments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {exams.length > 0 && (
            <div className="relative w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="search"
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
                placeholder="Search subject, class, or room..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-1.5 text-xs"
              />
            </div>
          )}

          {canAdd && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white hover:opacity-90 self-start whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Schedule Exam
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
      ) : filteredExams.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="w-6 h-6" />}
          title={exams.length === 0 ? 'No upcoming exams scheduled' : 'No matching exams found'}
          description={
            exams.length === 0
              ? 'Examination dates and hall details will appear here once published.'
              : 'Try adjusting your search query.'
          }
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-4">Subject / Assessment</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-5">Hall / Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredExams.map((ex) => (
                  <tr
                    key={ex.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3.5 px-5 font-mono tabular-nums font-medium">
                      {ex.examDate}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {ex.subjectName || ex.name}
                      </div>
                      <div className="text-xs text-slate-500">{ex.name}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {ex.className ? `${ex.className}-${ex.section}` : 'All Classes'}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums">
                      {ex.startTime}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {Math.floor(ex.durationMinutes / 60)}h{' '}
                      {ex.durationMinutes % 60 > 0 ? `${ex.durationMinutes % 60}m` : ''}
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400">
                      {ex.room || 'Main Exam Hall'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-base font-semibold">Add Exam to Timetable</h3>
            <form onSubmit={handleCreate} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Exam Title
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Term 2 Social Science"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Class (Optional)
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="">All Classes</option>
                    {classesOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}-{c.section}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Subject
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="">General</option>
                    {subjectsOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Start Time
                  </label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={360}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Room / Hall
                </label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--sc-primary)] text-white"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
