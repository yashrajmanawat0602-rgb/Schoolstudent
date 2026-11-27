import React, { useEffect, useState } from 'react';
import { BookOpen, ClipboardList, Download, FileText, Paperclip, Plus, Search, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, downloadProtectedFile } from '../services/api.ts';
import { AssignmentItem, HomeworkItem } from '../types/index.ts';
import { EmptyState, useToast } from './ui/ToastAndModal.tsx';

const ALLOWED_TASK_FILE_EXTS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.csv',
]);
const MAX_TASK_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const HomeworkAndAssignmentsView: React.FC<{
  classIdFilter?: number;
}> = ({ classIdFilter }) => {
  const { user, teacherClasses } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<'homework' | 'assignments'>('homework');
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [assignmentsList, setAssignmentsList] = useState<AssignmentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState<'homework' | 'assignment' | null>(null);
  const [classesOptions, setClassesOptions] = useState<Array<{ id: number; name: string; section: string }>>([]);
  const [subjectsOptions, setSubjectsOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formClassId, setFormClassId] = useState<number>(0);
  const [formSubjectId, setFormSubjectId] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState('2026-11-26');
  const [formPriority, setFormPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [formMaxScore, setFormMaxScore] = useState(25);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const loadData = async () => {
    setLoading(true);
    try {
      const qs = classIdFilter ? `?classId=${classIdFilter}` : '';
      const [hw, asg] = await Promise.all([
        apiFetch<HomeworkItem[]>(`/api/homework${qs}`),
        apiFetch<AssignmentItem[]>(`/api/assignments${qs}`),
      ]);
      setHomeworkList(hw);
      setAssignmentsList(asg);

      if (canCreate) {
        const td = await apiFetch<{
          myClasses: Array<{ id: number; name: string; section: string }>;
          subjects: Array<{ id: number; name: string }>;
        }>('/api/teacher/dashboard');
        setClassesOptions(td.myClasses);
        setSubjectsOptions(td.subjects);
        if (td.myClasses[0] && !formClassId) setFormClassId(td.myClasses[0].id);
        if (td.subjects[0] && !formSubjectId) setFormSubjectId(td.subjects[0].id);
      }
    } catch (err: any) {
      showToast('Unable to load tasks', err?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [classIdFilter]);

  const validateAndSelectFile = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const dotIdx = file.name.lastIndexOf('.');
    const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : '';
    if (!ALLOWED_TASK_FILE_EXTS.has(ext)) {
      showToast(
        'Unsupported File Type',
        'Please attach a PDF, DOC/DOCX, PPT/PPTX, TXT, PNG, JPG, WEBP, or CSV file.',
        'error'
      );
      return;
    }
    if (file.size > MAX_TASK_FILE_BYTES) {
      showToast('File Too Large', 'Maximum attachment size is 10 MB.', 'error');
      return;
    }
    setSelectedFile(file);
  };

  const closeCreateModal = () => {
    if (submitting) return;
    setCreateOpen(null);
    setSelectedFile(null);
    setDragActive(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedClassId = formClassId || teacherClasses[0]?.classId || 0;
    const resolvedSubjectId = formSubjectId || teacherClasses[0]?.subjectId || 0;
    if (!resolvedClassId || !resolvedSubjectId) {
      showToast('Missing Selection', 'Please select both a class and subject.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', formTitle);
      formData.append('description', formDesc);
      formData.append('classId', String(resolvedClassId));
      formData.append('subjectId', String(resolvedSubjectId));
      formData.append('dueDate', formDueDate);
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      if (createOpen === 'homework') {
        formData.append('priority', formPriority);
        await apiFetch('/api/teacher/homework', {
          method: 'POST',
          body: formData,
        });
        showToast('Homework Posted', 'Parents and students have been notified.');
      } else {
        formData.append('maxScore', String(Number(formMaxScore) || 25));
        await apiFetch('/api/teacher/assignments', {
          method: 'POST',
          body: formData,
        });
        showToast('Assignment Created', 'Assigned to class roster.');
      }
      setCreateOpen(null);
      setFormTitle('');
      setFormDesc('');
      setSelectedFile(null);
      setDragActive(false);
      loadData();
    } catch (err: any) {
      showToast('Validation Error', err?.message || 'Unable to save.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredHomework = homeworkList.filter((hw) => {
    if (!normalizedQuery) return true;
    return (
      hw.title.toLowerCase().includes(normalizedQuery) ||
      hw.description.toLowerCase().includes(normalizedQuery) ||
      hw.subjectName.toLowerCase().includes(normalizedQuery) ||
      `${hw.className}-${hw.section}`.toLowerCase().includes(normalizedQuery) ||
      hw.teacherName.toLowerCase().includes(normalizedQuery) ||
      hw.dueDate.toLowerCase().includes(normalizedQuery)
    );
  });
  const filteredAssignments = assignmentsList.filter((asg) => {
    if (!normalizedQuery) return true;
    return (
      asg.title.toLowerCase().includes(normalizedQuery) ||
      asg.description.toLowerCase().includes(normalizedQuery) ||
      asg.subjectName.toLowerCase().includes(normalizedQuery) ||
      `${asg.className}-${asg.section}`.toLowerCase().includes(normalizedQuery) ||
      asg.teacherName.toLowerCase().includes(normalizedQuery) ||
      asg.dueDate.toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Homework &amp; Assignments
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Daily practice tasks, worksheets, and graded class projects
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('homework')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'homework'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Homework ({homeworkList.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('assignments')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'assignments'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Assignments ({assignmentsList.length})
            </button>
          </div>

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setCreateOpen(tab === 'homework' ? 'homework' : 'assignment');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white hover:opacity-90 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {tab === 'homework' ? 'Add Homework' : 'Create Assignment'}
            </button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search homework, assignments, subject, class, or teacher..."
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          ))}
        </div>
      ) : tab === 'homework' ? (
        filteredHomework.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-6 h-6" />}
            title={homeworkList.length === 0 ? 'No homework yet' : 'No matching homework'}
            description={
              homeworkList.length === 0
                ? 'Your teacher hasn’t posted any homework for this class.'
                : 'Try adjusting your search query.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredHomework.map((hw) => (
              <div
                key={hw.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <span className="font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                      {hw.subjectName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {hw.className}-{hw.section}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        hw.priority === 'HIGH'
                          ? 'text-red-600 dark:text-red-400 font-semibold'
                          : ''
                      }
                    >
                      {hw.priority} Priority
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {hw.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {hw.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    Due <strong className="font-mono text-slate-800 dark:text-slate-200">{hw.dueDate}</strong> · {hw.teacherName}
                  </span>
                  {hw.attachmentUrl && hw.attachmentName && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadProtectedFile(hw.attachmentUrl!, hw.attachmentName!).catch(() =>
                          showToast('Download failed', 'Could not download attachment.', 'error')
                        )
                      }
                      title={hw.attachmentName}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-[var(--sc-primary)] dark:text-blue-400 max-w-[220px]"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{hw.attachmentName}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredAssignments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-6 h-6" />}
          title={assignmentsList.length === 0 ? 'No assignments posted' : 'No matching assignments'}
          description={
            assignmentsList.length === 0
              ? 'Graded projects and term assignments will appear here once published.'
              : 'Try adjusting your search query.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAssignments.map((asg) => (
            <div
              key={asg.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                  <span className="font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                    {asg.subjectName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {asg.className}-{asg.section}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">Max {asg.maxScore} pts</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {asg.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">
                  {asg.description}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  Due <strong className="font-mono text-slate-800 dark:text-slate-200">{asg.dueDate}</strong> · {asg.teacherName}
                </span>
                <div className="flex items-center gap-2">
                  {asg.attachmentUrl && asg.attachmentName && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadProtectedFile(asg.attachmentUrl!, asg.attachmentName!).catch(() =>
                          showToast('Download failed', 'Could not download attachment.', 'error')
                        )
                      }
                      title={asg.attachmentName}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-[var(--sc-primary)] dark:text-blue-400 max-w-[200px]"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{asg.attachmentName}</span>
                    </button>
                  )}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {asg.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Homework / Assignment Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl my-auto">
            <h3 className="text-base font-semibold">
              {createOpen === 'homework' ? 'Post Class Homework' : 'Create Graded Assignment'}
            </h3>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Chapter 4 — Quadratic Equations"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Class
                  </label>
                  <select
                    value={formClassId}
                    onChange={(e) => setFormClassId(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
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
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    {subjectsOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Instructions
                </label>
                <textarea
                  rows={3}
                  required
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Complete Questions 1–10 and submit in notebook."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                {createOpen === 'homework' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Priority
                    </label>
                    <select
                      value={formPriority}
                      onChange={(e) =>
                        setFormPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Maximum Score
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={formMaxScore}
                      onChange={(e) => setFormMaxScore(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Attach Worksheet / Reference File (Optional)
                </label>
                {selectedFile ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[var(--sc-primary)] shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {selectedFile.name}
                      </span>
                      <span className="font-mono text-slate-500 shrink-0">
                        ({formatBytes(selectedFile.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      aria-label="Remove selected file"
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-red-600 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      validateAndSelectFile(e.dataTransfer.files?.[0] || null);
                    }}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-3.5 text-xs cursor-pointer transition-colors ${
                      dragActive
                        ? 'border-[var(--sc-primary)] bg-blue-50/50 dark:bg-blue-950/20 text-[var(--sc-primary)]'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <Upload className="w-4 h-4" />
                      <span>Click to choose or drop file here</span>
                    </div>
                    <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      PDF, DOC/DOCX, PPT/PPTX, PNG, JPG, TXT, CSV · Max 10 MB
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.csv"
                      onChange={(e) => validateAndSelectFile(e.target.files?.[0] || null)}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={closeCreateModal}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--sc-primary)] text-white disabled:opacity-60"
                >
                  {submitting ? 'Uploading & Saving...' : 'Save & Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
