import React, { useMemo, useState } from 'react';
import { Award, BarChart3, Printer, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StudentOverviewResponse } from '../types/index.ts';
import { EmptyState } from './ui/ToastAndModal.tsx';

export const AcademicPerformanceView: React.FC<{
  overview: StudentOverviewResponse;
}> = ({ overview }) => {
  const examNames = useMemo(
    () => Array.from(new Set(overview.marks.map((m) => m.examName))),
    [overview.marks]
  );

  const [selectedExam, setSelectedExam] = useState<string>(examNames[0] || '');

  const activeExamName = examNames.includes(selectedExam)
    ? selectedExam
    : examNames[0] || '';

  const filteredMarks = useMemo(
    () => overview.marks.filter((m) => m.examName === activeExamName),
    [overview.marks, activeExamName]
  );

  const overallStats = useMemo(() => {
    if (filteredMarks.length === 0) {
      return { totalObtained: 0, totalMax: 0, pct: 0, topSubject: '-' };
    }
    const totalObtained = filteredMarks.reduce((acc, m) => acc + m.obtainedMarks, 0);
    const totalMax = filteredMarks.reduce((acc, m) => acc + m.maxMarks, 0);
    const pct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;
    const sorted = [...filteredMarks].sort((a, b) => b.percentage - a.percentage);
    return {
      totalObtained,
      totalMax,
      pct,
      topSubject: sorted[0]?.subjectName || '-',
    };
  }, [filteredMarks]);

  const subjectChartData = useMemo(
    () =>
      filteredMarks.map((m) => ({
        subject: m.subjectName.replace('Computer Science', 'CS').replace('Social Science', 'Social'),
        Student: m.percentage,
        'Class Avg': m.classAveragePct ?? 0,
      })),
    [filteredMarks]
  );

  const examComparisonData = useMemo(() => {
    const bySubject = new Map<string, Record<string, string | number>>();
    for (const m of overview.marks) {
      const key = m.subjectName.replace('Computer Science', 'CS').replace('Social Science', 'Social');
      const existing = bySubject.get(key) || { subject: key };
      existing[m.examName] = m.percentage;
      bySubject.set(key, existing);
    }
    return Array.from(bySubject.values());
  }, [overview.marks]);

  if (overview.marks.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="w-6 h-6" />}
        title="No results available yet"
        description="Marks and assessment reports will appear here once published by your teachers."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Exam Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Academic Performance
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {overview.student.fullName} · {overview.student.className}-{overview.student.section} · Aggregated class averages are anonymized
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
          {examNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedExam(name)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeExamName === name
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Overall Percentage</span>
            <TrendingUp className="w-4 h-4 text-[var(--sc-primary)] dark:text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {overallStats.pct}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {overallStats.totalObtained} / {overallStats.totalMax} Total Marks
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Highest Subject</span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
            {overallStats.topSubject}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {activeExamName}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Subjects Evaluated</span>
            <BarChart3 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {filteredMarks.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            All results verified
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Subject Score vs. Class Average (%)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            {activeExamName} · Peer identities remain private
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Student" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Class Avg" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Exam-Wise Progress Comparison
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            Subject percentage progression across assessments
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={examComparisonData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {examNames.map((ex, idx) => (
                  <Bar
                    key={ex}
                    dataKey={ex}
                    fill={idx === 0 ? '#1e3a8a' : '#d97706'}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Subject Marks Breakdown Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Detailed Marksheet — {activeExamName}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {filteredMarks.length} Subjects
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 print:hidden"
            >
              <Printer className="w-3.5 h-3.5" /> Print Report Card
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-5">Subject</th>
                <th className="py-3 px-4 text-right">Marks</th>
                <th className="py-3 px-4 text-right">Max Marks</th>
                <th className="py-3 px-4 text-right">Percentage</th>
                <th className="py-3 px-4 text-center">Grade</th>
                <th className="py-3 px-4 text-right">Class Avg</th>
                <th className="py-3 px-5">Teacher Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredMarks.map((m) => (
                <tr
                  key={m.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-slate-100">
                    {m.subjectName}
                    <span className="ml-2 text-xs text-slate-400 font-mono">
                      {m.subjectCode}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                    {m.obtainedMarks}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500">
                    {m.maxMarks}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                    {m.percentage}%
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900 dark:text-slate-100">
                    {m.grade}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500">
                    {m.classAveragePct !== null ? `${m.classAveragePct}%` : '-'}
                  </td>
                  <td className="py-3.5 px-5 text-xs text-slate-600 dark:text-slate-400 max-w-xs">
                    {m.teacherRemark || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
