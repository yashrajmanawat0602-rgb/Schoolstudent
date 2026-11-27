import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Pencil,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiFetch } from '../services/api.ts';
import { ConfirmDialog, useToast } from './ui/ToastAndModal.tsx';

interface MarkRecord {
  id: number;
  studentId: number;
  studentCode: string;
  studentName: string;
  rollNumber: number;
  classId: number;
  className: string;
  section: string;
  subjectId: number;
  subjectName: string;
  examId: number;
  examName: string;
  obtainedMarks: number;
  maxMarks: number;
  grade: string;
  teacherRemark: string | null;
}

const SAMPLE_CSV = `Student ID,Subject,Exam,Marks,Max Marks,Remark
STU-10A-001,Mathematics,Mid-Term Examination,89,100,Strong improvement in algebra
STU-10A-002,Mathematics,Mid-Term Examination,92,100,Excellent analytical accuracy
STU-10A-003,Mathematics,Mid-Term Examination,78,100,Good conceptual clarity`;

export const TeacherMarksView: React.FC = () => {
  const { showToast } = useToast();
  const [classes, setClasses] = useState<Array<{ id: number; name: string; section: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string }>>([]);
  const [exams, setExams] = useState<Array<{ id: number; name: string }>>([]);
  const [students, setStudents] = useState<
    Array<{ id: number; studentCode: string; fullName: string; rollNumber: number; classId: number }>
  >([]);
  const [marks, setMarks] = useState<MarkRecord[]>([]);

  const [classId, setClassId] = useState<number>(0);
  const [subjectId, setSubjectId] = useState<number>(0);
  const [examId, setExamId] = useState<number>(0);

  // Entry Form
  const [selectedStudentId, setSelectedStudentId] = useState<number>(0);
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [obtainedMarks, setObtainedMarks] = useState<number>(85);
  const [teacherRemark, setTeacherRemark] = useState('');
  const [saving, setSaving] = useState(false);

  // CSV Import
  const [mode, setMode] = useState<'entry' | 'csv'>('entry');
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  // Delete confirmation & search
  const [deleteTarget, setDeleteTarget] = useState<MarkRecord | null>(null);
  const [marksSearch, setMarksSearch] = useState('');

  const loadContext = async () => {
    try {
      const td = await apiFetch<{
        myClasses: Array<{ id: number; name: string; section: string }>;
        subjects: Array<{ id: number; name: string }>;
        exams: Array<{ id: number; name: string }>;
      }>('/api/teacher/dashboard');
      setClasses(td.myClasses);
      setSubjects(td.subjects);
      setExams(td.exams);
      if (td.myClasses[0] && !classId) setClassId(td.myClasses[0].id);
      if (td.subjects[0] && !subjectId) setSubjectId(td.subjects[0].id);
      if (td.exams[1] && !examId) setExamId(td.exams[1].id);
      else if (td.exams[0] && !examId) setExamId(td.exams[0].id);
    } catch (err: any) {
      showToast('Failed to load options', err?.message, 'error');
    }
  };

  const loadStudentsAndMarks = async () => {
    if (!classId) return;
    try {
      const [stuRows, markRows] = await Promise.all([
        apiFetch<
          Array<{
            id: number;
            studentCode: string;
            fullName: string;
            rollNumber: number;
            classId: number;
          }>
        >(`/api/teacher/students?classId=${classId}`),
        apiFetch<MarkRecord[]>(
          `/api/teacher/marks?classId=${classId}${subjectId ? `&subjectId=${subjectId}` : ''}${examId ? `&examId=${examId}` : ''}`
        ),
      ]);
      setStudents(stuRows);
      setMarks(markRows);
      if (stuRows[0] && !stuRows.some((s) => s.id === selectedStudentId)) {
        setSelectedStudentId(stuRows[0].id);
      }
    } catch (err: any) {
      showToast('Failed to load marks', err?.message, 'error');
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    loadStudentsAndMarks();
  }, [classId, subjectId, examId]);

  const handleSaveMark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (obtainedMarks > maxMarks) {
      showToast('Validation Error', 'Obtained marks cannot exceed maximum marks.', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/teacher/marks', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudentId,
          subjectId,
          examId,
          obtainedMarks: Number(obtainedMarks),
          maxMarks: Number(maxMarks),
          teacherRemark,
        }),
      });
      showToast('Marks Saved', 'Student marks updated and parent notified.');
      setTeacherRemark('');
      loadStudentsAndMarks();
    } catch (err: any) {
      showToast('Save Failed', err?.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditRow = (row: MarkRecord) => {
    setMode('entry');
    setSelectedStudentId(row.studentId);
    setMaxMarks(row.maxMarks);
    setObtainedMarks(row.obtainedMarks);
    setTeacherRemark(row.teacherRemark || '');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/teacher/marks/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      showToast('Mark record deleted');
      setDeleteTarget(null);
      loadStudentsAndMarks();
    } catch (err: any) {
      showToast('Delete failed', err?.message, 'error');
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setCsvErrors([]);
    setImporting(true);
    try {
      const res = await apiFetch<{ importedCount: number }>('/api/teacher/marks/csv', {
        method: 'POST',
        body: JSON.stringify({ csvText, overwriteExisting }),
      });
      showToast(
        'Bulk Marks Imported',
        `Validated and saved ${res.importedCount} student mark records.`
      );
      loadStudentsAndMarks();
    } catch (err: any) {
      if (err?.validationErrors?.length) {
        setCsvErrors(err.validationErrors);
      } else {
        setCsvErrors([err?.message || 'CSV validation failed.']);
      }
      showToast('CSV Validation Failed', 'Please review the errors highlighted below.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleCsvFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const downloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schoolconnect_marks_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Marks Management
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select Class → Subject → Exam to enter, edit, or bulk-import validated CSV results
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setMode('entry')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              mode === 'entry'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Individual Entry
          </button>
          <button
            type="button"
            onClick={() => setMode('csv')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              mode === 'csv'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            CSV / Excel Bulk Import
          </button>
        </div>
      </div>

      {/* Step Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            1. Class
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
            2. Subject
          </label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            3. Exam
          </label>
          <select
            value={examId}
            onChange={(e) => setExamId(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'entry' ? (
        <form
          onSubmit={handleSaveMark}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold">4. Enter / Update Student Marks</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-medium text-slate-500">
                  Student
                </label>
                <span className="text-[11px] text-slate-400">
                  {students.length} in class
                </span>
              </div>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    Roll #{s.rollNumber} · {s.fullName} ({s.studentCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Obtained Marks
              </label>
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
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Maximum Marks
              </label>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Teacher Remark (Optional)
              </label>
              <input
                type="text"
                value={teacherRemark}
                onChange={(e) => setTeacherRemark(e.target.value)}
                placeholder="Shows strong improvement in mathematics."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !selectedStudentId}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--sc-primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Mark'}
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={handleCsvImport}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold inline-flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[var(--sc-primary)] dark:text-blue-400" />
                Bulk CSV / Excel-Compatible Marks Import
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Format: <code className="font-mono">Student ID,Subject,Exam,Marks,Max Marks,Remark</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                Template CSV
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Load CSV File
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvFileUpload(f);
                  }}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <textarea
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono"
          />

          {csvErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-4 space-y-1.5"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4" />
                Validation Errors Found ({csvErrors.length})
              </div>
              <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 list-disc pl-5">
                {csvErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
              />
              Update existing marks if student already has a score for this exam (uncheck to strictly reject duplicates)
            </label>
            <button
              type="submit"
              disabled={importing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--sc-primary)] text-white text-sm font-semibold disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {importing ? 'Validating & Importing...' : 'Validate & Import Marks'}
            </button>
          </div>
        </form>
      )}

      {/* Recorded Marks Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Recorded Marks ({marks.length})</h3>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={marksSearch}
              onChange={(e) => setMarksSearch(e.target.value)}
              placeholder="Search student name, ID, roll #, or remark..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Roll</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Student ID</th>
                <th className="py-3 px-4 text-right">Marks</th>
                <th className="py-3 px-4 text-center">Grade</th>
                <th className="py-3 px-4">Remark</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(() => {
                const mq = marksSearch.trim().toLowerCase();
                const filteredMarks = marks.filter(
                  (m) =>
                    !mq ||
                    m.studentName.toLowerCase().includes(mq) ||
                    m.studentCode.toLowerCase().includes(mq) ||
                    String(m.rollNumber).includes(mq) ||
                    (m.teacherRemark || '').toLowerCase().includes(mq)
                );
                if (filteredMarks.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                        No matching student marks records found.
                      </td>
                    </tr>
                  );
                }
                return filteredMarks.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono tabular-nums">{m.rollNumber}</td>
                  <td className="py-3 px-4 font-medium">{m.studentName}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-500">
                    {m.studentCode}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    {m.obtainedMarks} / {m.maxMarks}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold">
                    {m.grade}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {m.teacherRemark || '—'}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleEditRow(m)}
                      aria-label={`Edit marks for ${m.studentName}`}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 mr-1"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(m)}
                      aria-label={`Delete marks for ${m.studentName}`}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Mark Record"
        description={
          deleteTarget
            ? `Remove ${deleteTarget.subjectName} marks (${deleteTarget.obtainedMarks}/${deleteTarget.maxMarks}) for ${deleteTarget.studentName}?`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
