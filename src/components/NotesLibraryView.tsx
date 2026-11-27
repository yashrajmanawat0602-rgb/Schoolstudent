import React, { useEffect, useMemo, useState } from 'react';
import { BookMarked, Download, FileText, Plus, Search, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, downloadProtectedFile } from '../services/api.ts';
import { StudyNoteItem } from '../types/index.ts';
import { EmptyState, useToast } from './ui/ToastAndModal.tsx';

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 1} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const NotesLibraryView: React.FC<{
  classIdFilter?: number;
  aiCommand?: { query?: string; nonce: number } | null;
}> = ({ classIdFilter, aiCommand }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notes, setNotes] = useState<StudyNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('ALL');

  useEffect(() => {
    if (aiCommand?.query !== undefined) {
      setSearchQuery(aiCommand.query);
    }
  }, [aiCommand?.nonce]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [classesOptions, setClassesOptions] = useState<Array<{ id: number; name: string; section: string }>>([]);
  const [subjectsOptions, setSubjectsOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [title, setTitle] = useState('');
  const [chapter, setChapter] = useState('');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [classId, setClassId] = useState(0);
  const [subjectId, setSubjectId] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const canUpload = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const loadNotes = async () => {
    setLoading(true);
    try {
      const qs = classIdFilter ? `?classId=${classIdFilter}` : '';
      const rows = await apiFetch<StudyNoteItem[]>(`/api/notes${qs}`);
      setNotes(rows);

      if (canUpload) {
        const td = await apiFetch<{
          myClasses: Array<{ id: number; name: string; section: string }>;
          subjects: Array<{ id: number; name: string }>;
        }>('/api/teacher/dashboard');
        setClassesOptions(td.myClasses);
        setSubjectsOptions(td.subjects);
        if (td.myClasses[0] && !classId) setClassId(td.myClasses[0].id);
        if (td.subjects[0] && !subjectId) setSubjectId(td.subjects[0].id);
      }
    } catch (err: any) {
      showToast('Failed to load notes', err?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [classIdFilter]);

  const subjectTabs = useMemo(() => {
    const names = Array.from(new Set(notes.map((n) => n.subjectName)));
    return ['ALL', ...names];
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes.filter((n) => {
      if (subjectFilter !== 'ALL' && n.subjectName !== subjectFilter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.chapter.toLowerCase().includes(q) ||
        n.topic.toLowerCase().includes(q) ||
        n.subjectName.toLowerCase().includes(q) ||
        n.teacherName.toLowerCase().includes(q)
      );
    });
  }, [notes, subjectFilter, searchQuery]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('chapter', chapter);
      formData.append('topic', topic);
      formData.append('content', content);
      formData.append('classId', String(classId));
      formData.append('subjectId', String(subjectId));
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await apiFetch('/api/teacher/notes', {
        method: 'POST',
        body: formData,
      });

      showToast('Study Notes Uploaded', 'Students and parents can now download this material.');
      setUploadOpen(false);
      setTitle('');
      setChapter('');
      setTopic('');
      setContent('');
      setSelectedFile(null);
      loadNotes();
    } catch (err: any) {
      showToast('Upload Failed', err?.message || 'Unable to upload notes.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Digital Notes Library
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Organized by Class, Subject, Chapter, and Topic for instant study access
          </p>
        </div>

        {canUpload && (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white hover:opacity-90 self-start whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Upload Study Material
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {subjectTabs.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setSubjectFilter(sub)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subjectFilter === sub
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {sub === 'ALL' ? 'All Subjects' : sub}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chapters, topics, notes..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sc-primary)]"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <EmptyState
          icon={<BookMarked className="w-6 h-6" />}
          title="No study notes found"
          description="Try clearing your search filter or check back once teachers upload chapter notes."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                  <span>
                    {note.className}-{note.section}
                  </span>
                  <span aria-hidden="true">→</span>
                  <span className="font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                    {note.subjectName}
                  </span>
                  <span aria-hidden="true">→</span>
                  <span className="truncate">{note.chapter}</span>
                </div>

                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {note.title}
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Topic: {note.topic}
                </p>
                {note.content && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                    {note.content}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                  <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                  <span className="truncate font-mono">{note.fileName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono shrink-0">
                    {formatBytes(note.fileSizeBytes)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    downloadProtectedFile(note.fileUrl, note.fileName).catch(() =>
                      showToast('Download failed', 'Could not download this file.', 'error')
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Study Material Modal */}
      {uploadOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-base font-semibold">Upload Study Material</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Supports PDF, DOC/DOCX, PPT/PPTX, Images, or written study guides (Max 10 MB)
            </p>
            <form onSubmit={handleUpload} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Electricity — Chapter Revision Notes"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Class
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(Number(e.target.value))}
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
                    value={subjectId}
                    onChange={(e) => setSubjectId(Number(e.target.value))}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Chapter
                  </label>
                  <input
                    type="text"
                    required
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    placeholder="Chapter 12: Electricity"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Topic
                  </label>
                  <input
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ohm’s Law & Circuits"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Summary / Text Notes
                </label>
                <textarea
                  rows={2}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Optional summary notes for quick reading..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Attach Document (PDF, DOCX, PPTX, Image, TXT)
                </label>
                <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <Upload className="w-4 h-4" />
                  <span>{selectedFile ? selectedFile.name : 'Choose a file or leave empty to save as text note'}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--sc-primary)] text-white disabled:opacity-60"
                >
                  {uploading ? 'Uploading...' : 'Publish Notes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
