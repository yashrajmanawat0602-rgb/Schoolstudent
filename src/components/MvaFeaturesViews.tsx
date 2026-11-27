import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Image as ImageIcon,
  Plus,
  Printer,
  Receipt,
  Search,
  ShieldCheck,
  Smartphone,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import {
  FeesSummaryResponse,
  FeeRecordItem,
  GalleryItem,
  TimetableEntry,
} from '../types/index.ts';
import {
  formatPaymentMethodLabel,
  ParentFeeCheckoutModal,
} from './ParentFeeCheckoutModal.tsx';
import { DashboardSkeleton, EmptyState, useToast } from './ui/ToastAndModal.tsx';

const DAYS: Array<{ code: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'; label: string }> = [
  { code: 'MON', label: 'Monday' },
  { code: 'TUE', label: 'Tuesday' },
  { code: 'WED', label: 'Wednesday' },
  { code: 'THU', label: 'Thursday' },
  { code: 'FRI', label: 'Friday' },
  { code: 'SAT', label: 'Saturday' },
];

export const ClassTimetableView: React.FC<{ classIdFilter?: number }> = ({
  classIdFilter,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [classesList, setClassesList] = useState<
    Array<{ id: number; name: string; section: string; roomNumber: string | null }>
  >([]);
  const [selectedClassId, setSelectedClassId] = useState<number>(classIdFilter || 0);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<'ALL' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'>('ALL');
  const [loading, setLoading] = useState(true);

  const loadTimetable = async (clsId?: number) => {
    setLoading(true);
    try {
      const qs = clsId ? `?classId=${clsId}` : '';
      const res = await apiFetch<{
        classes: Array<{ id: number; name: string; section: string; roomNumber: string | null }>;
        entries: TimetableEntry[];
      }>(`/api/timetable${qs}`);
      setClassesList(res.classes);
      setEntries(res.entries);
      if (!clsId && res.classes[0]) {
        setSelectedClassId(res.classes[0].id);
      }
    } catch (err: any) {
      showToast('Unable to load timetable', err?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = classIdFilter || selectedClassId || undefined;
    loadTimetable(initial);
  }, [classIdFilter]);

  if (loading) return <DashboardSkeleton />;

  const activeClass =
    classesList.find((c) => c.id === (classIdFilter || selectedClassId)) || classesList[0];

  const daysToRender =
    selectedDay === 'ALL' ? DAYS : DAYS.filter((d) => d.code === selectedDay);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Class Timetable &amp; Daily Schedule
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {activeClass
              ? `${activeClass.name}-${activeClass.section} · Homeroom ${activeClass.roomNumber || 'Main Block'}`
              : 'Weekly period timetable and faculty allocations'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(user?.role === 'TEACHER' || user?.role === 'ADMIN') && classesList.length > 1 && (
            <select
              value={selectedClassId}
              onChange={(e) => {
                const nextId = Number(e.target.value);
                setSelectedClassId(nextId);
                loadTimetable(nextId);
              }}
              aria-label="Select class timetable"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
            >
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}-{c.section}
                </option>
              ))}
            </select>
          )}

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setSelectedDay('ALL')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                selectedDay === 'ALL'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Full Week
            </button>
            {DAYS.map((d) => (
              <button
                key={d.code}
                type="button"
                onClick={() => setSelectedDay(d.code)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                  selectedDay === d.code
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {d.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="w-6 h-6" />}
          title="No timetable periods scheduled"
          description="Class periods for this section will appear once published by the academic office."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {daysToRender.map((day) => {
            const dayPeriods = entries
              .filter((e) => e.dayOfWeek === day.code)
              .sort((a, b) => a.periodNumber - b.periodNumber);

            return (
              <section
                key={day.code}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {day.label}
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    {dayPeriods.length} periods
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dayPeriods.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            P{p.periodNumber} · {p.startTime}–{p.endTime}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                          {p.subjectName}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {p.teacherName} · {p.room || 'Classroom'}
                        </div>
                      </div>
                      <span className="text-xs font-mono font-semibold text-[var(--sc-primary)] dark:text-blue-400 shrink-0">
                        {p.subjectCode}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface AdminFeeRow extends FeeRecordItem {
  studentCode: string;
  studentName: string;
  className: string;
  section: string;
}

export const FeeManagementView: React.FC<{ studentId?: number | null }> = ({
  studentId,
}) => {
  const { user, schoolSettings } = useAuth();
  const { showToast } = useToast();
  const [studentFees, setStudentFees] = useState<FeesSummaryResponse | null>(null);
  const [adminFees, setAdminFees] = useState<AdminFeeRow[]>([]);
  const [classesList, setClassesList] = useState<Array<{ id: number; name: string; section: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [payingItem, setPayingItem] = useState<FeeRecordItem | null>(null);
  const [viewReceiptItem, setViewReceiptItem] = useState<FeeRecordItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [adminFeeSearch, setAdminFeeSearch] = useState('');
  const [adminFeeStatusFilter, setAdminFeeStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');
  const [adminFeeClassFilter, setAdminFeeClassFilter] = useState<string>('ALL');
  const [studentFeeSearch, setStudentFeeSearch] = useState('');

  // Admin invoice form
  const [invoiceTitle, setInvoiceTitle] = useState('');
  const [invoiceCategory, setInvoiceCategory] = useState<'TUITION' | 'TRANSPORT' | 'EXAM' | 'LAB'>('TUITION');
  const [invoiceAmount, setInvoiceAmount] = useState(5000);
  const [invoiceDueDate, setInvoiceDueDate] = useState('2026-12-15');
  const [invoiceClassId, setInvoiceClassId] = useState(0);

  const isAdmin = user?.role === 'ADMIN';

  const loadFees = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const [rows, clsRes] = await Promise.all([
          apiFetch<AdminFeeRow[]>('/api/admin/fees'),
          apiFetch<{ classes: Array<{ id: number; name: string; section: string }> }>('/api/admin/classes'),
        ]);
        setAdminFees(rows);
        setClassesList(clsRes.classes);
        if (clsRes.classes[0] && !invoiceClassId) {
          setInvoiceClassId(clsRes.classes[0].id);
        }
      } else if (studentId) {
        const data = await apiFetch<FeesSummaryResponse>(`/api/students/${studentId}/fees`);
        setStudentFees(data);
      }
    } catch (err: any) {
      showToast('Failed to load fees', err?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFees();
  }, [studentId, isAdmin]);

  const handleConfirmPay = async () => {
    if (!payingItem) return;
    setSubmitting(true);
    try {
      const targetStuId = studentId || payingItem.studentId;
      await apiFetch(`/api/students/${targetStuId}/fees/${payingItem.id}/pay`, {
        method: 'POST',
      });
      showToast('Payment Recorded', `Receipt issued for ${payingItem.title}`);
      setPayingItem(null);
      loadFees();
    } catch (err: any) {
      showToast('Payment Failed', err?.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadReceipt = (item: FeeRecordItem, studentLabel?: string) => {
    const content = [
      `${schoolSettings?.schoolName || 'Macro Vision Academy Burhanpur'} — FEE PAYMENT RECEIPT`,
      '================================================================',
      `Receipt Number   : ${item.receiptNo || `MVA-REF-${item.id}`}`,
      `Student          : ${studentLabel || studentFees?.payerDefaults?.studentName || `Student #${item.studentId}`}`,
      `Fee Item         : ${item.title} (${item.category})`,
      `Amount Paid      : INR ${item.amount.toLocaleString()}`,
      `Payment Method   : ${formatPaymentMethodLabel(item.paymentMethod)}`,
      `Transaction / UTR: ${item.transactionRef || 'Verified'}`,
      `Payer Name       : ${item.payerName || studentFees?.payerDefaults?.fullName || 'Parent / Guardian'}`,
      `Payer Mobile     : ${item.payerPhone || studentFees?.payerDefaults?.phone || 'On File'}`,
      `Payment Date     : ${item.paidDate || 'Verified'}`,
      `Status           : ${item.status}`,
      '================================================================',
      'Generated electronically by Macro Vision Academy Burhanpur Fee Portal.',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.receiptNo || `receipt_${item.id}`}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleIssueClassInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ count: number }>('/api/admin/fees', {
        method: 'POST',
        body: JSON.stringify({
          classId: invoiceClassId,
          title: invoiceTitle,
          category: invoiceCategory,
          amount: Number(invoiceAmount),
          dueDate: invoiceDueDate,
        }),
      });
      showToast('Fee Invoices Issued', `Created ${res.count} invoices for selected class.`);
      setInvoiceTitle('');
      loadFees();
    } catch (err: any) {
      showToast('Could not issue invoice', err?.message, 'error');
    }
  };

  if (loading) return <DashboardSkeleton />;

  if (isAdmin) {
    const q = adminFeeSearch.trim().toLowerCase();
    const filteredAdminFees = adminFees.filter((f) => {
      if (adminFeeStatusFilter !== 'ALL' && f.status !== adminFeeStatusFilter) return false;
      const clsLabel = `${f.className}-${f.section}`;
      if (adminFeeClassFilter !== 'ALL' && clsLabel !== adminFeeClassFilter) return false;
      if (!q) return true;
      return (
        f.studentName.toLowerCase().includes(q) ||
        f.studentCode.toLowerCase().includes(q) ||
        clsLabel.toLowerCase().includes(q) ||
        f.title.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        (f.receiptNo || '').toLowerCase().includes(q) ||
        (f.transactionRef || '').toLowerCase().includes(q)
      );
    });

    const totalCollected = filteredAdminFees
      .filter((f) => f.status === 'PAID')
      .reduce((s, f) => s + f.amount, 0);
    const totalOutstanding = filteredAdminFees
      .filter((f) => f.status !== 'PAID')
      .reduce((s, f) => s + f.amount, 0);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            School Fee Management &amp; Invoicing
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Issue class-wide fee invoices and track student fee payments
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="text-xs text-slate-500">Collected (Visible Ledger)</div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              ₹{totalCollected.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="text-xs text-slate-500">Pending / Overdue Due</div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">
              ₹{totalOutstanding.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="text-xs text-slate-500">Matching Invoices</div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums">
              {filteredAdminFees.length}
              {filteredAdminFees.length !== adminFees.length && (
                <span className="ml-1.5 text-xs font-normal text-slate-500">
                  / {adminFees.length}
                </span>
              )}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleIssueClassInvoice}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
        >
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <Plus className="w-4 h-4 text-[var(--sc-primary)]" />
            Issue New Class Fee Invoice
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select
              value={invoiceClassId}
              onChange={(e) => setInvoiceClassId(Number(e.target.value))}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}-{c.section}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={invoiceTitle}
              onChange={(e) => setInvoiceTitle(e.target.value)}
              placeholder="Annual Sports & Excursion Fee"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
            <select
              value={invoiceCategory}
              onChange={(e) =>
                setInvoiceCategory(e.target.value as 'TUITION' | 'TRANSPORT' | 'EXAM' | 'LAB')
              }
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="TUITION">Tuition</option>
              <option value="EXAM">Exam</option>
              <option value="LAB">Lab</option>
              <option value="TRANSPORT">Transport</option>
            </select>
            <input
              type="number"
              min={100}
              required
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(Number(e.target.value))}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
            />
            <input
              type="date"
              required
              value={invoiceDueDate}
              onChange={(e) => setInvoiceDueDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold"
          >
            Issue Fee Invoice
          </button>
        </form>

        {/* Search & Filter Bar for Fee Ledger */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={adminFeeSearch}
              onChange={(e) => setAdminFeeSearch(e.target.value)}
              placeholder="Search student name, Student ID, class, fee title, or receipt #..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={adminFeeClassFilter}
              onChange={(e) => setAdminFeeClassFilter(e.target.value)}
              aria-label="Filter by class"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
            >
              <option value="ALL">All Classes</option>
              {classesList.map((c) => {
                const label = `${c.name}-${c.section}`;
                return (
                  <option key={c.id} value={label}>
                    {label}
                  </option>
                );
              })}
            </select>
            <select
              value={adminFeeStatusFilter}
              onChange={(e) =>
                setAdminFeeStatusFilter(
                  e.target.value as 'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'
                )
              }
              aria-label="Filter by fee status"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Student Fee Ledger
            </span>
            <span className="font-mono">
              Showing {Math.min(filteredAdminFees.length, 100)} of {filteredAdminFees.length} records
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Fee Title</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredAdminFees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                      No matching student fee records found.
                    </td>
                  </tr>
                ) : (
                  filteredAdminFees.slice(0, 100).map((f) => (
                  <tr key={f.id}>
                    <td className="py-3 px-4">
                      <div className="font-medium">{f.studentName}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {f.studentCode} · {f.className}-{f.section}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{f.title}</div>
                      <div className="text-xs text-slate-500">{f.category}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{f.dueDate}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      ₹{f.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      {f.status === 'PAID' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                          </span>
                          {f.paymentMethod && (
                            <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                              {formatPaymentMethodLabel(f.paymentMethod)}
                              {f.transactionRef ? ` · ${f.transactionRef}` : ''}
                            </div>
                          )}
                        </div>
                      ) : f.status === 'OVERDUE' ? (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-3.5 h-3.5" /> Overdue
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {f.status === 'PAID' ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(f, `${f.studentName} (${f.studentCode})`)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" /> {f.receiptNo}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPayingItem(f)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {payingItem && (
          <PayConfirmModal
            item={payingItem}
            submitting={submitting}
            onClose={() => setPayingItem(null)}
            onConfirm={handleConfirmPay}
          />
        )}
      </div>
    );
  }

  if (!studentFees) {
    return (
      <EmptyState
        icon={<CreditCard className="w-6 h-6" />}
        title="No student selected"
        description="Select a linked student account to view fee statements and receipts."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Fee Status &amp; Online Payment Portal
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Pay securely via PhonePe, Google Pay, Paytm, BHIM UPI QR, or Card/NetBanking with instant verified receipts
        </p>
      </div>

      {/* Verified Online Payment Info & Student Billing Summary */}
      {studentFees.merchantConfig && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[var(--sc-primary)] dark:text-blue-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                Official School UPI &amp; Payment Account
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                Payee: <strong>{studentFees.merchantConfig.payeeName}</strong> · UPI ID:{' '}
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {studentFees.merchantConfig.upiId}
                </span>
              </div>
              <div className="text-slate-500">
                {studentFees.merchantConfig.bankAccountSummary} · ₹0 Convenience Fee
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <span className="px-2.5 py-1 rounded-md bg-[#5F259F] text-white">PhonePe</span>
            <span className="px-2.5 py-1 rounded-md bg-[#1A73E8] text-white">Google Pay</span>
            <span className="px-2.5 py-1 rounded-md bg-[#00BAF2] text-slate-950">Paytm</span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-700 text-white">BHIM UPI QR</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              Card / NetBanking
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Total Paid</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            ₹{studentFees.summary.totalPaid.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Upcoming Due</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">
            ₹{studentFees.summary.totalPending.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Overdue Balance</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-red-600">
            ₹{studentFees.summary.totalOverdue.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="search"
            value={studentFeeSearch}
            onChange={(e) => setStudentFeeSearch(e.target.value)}
            placeholder="Search fee item, category, status, or receipt #..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Fee Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status &amp; Reference</th>
                <th className="py-3 px-4 text-right">Receipt / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {studentFees.records
                .filter((rec) => {
                  const sq = studentFeeSearch.trim().toLowerCase();
                  if (!sq) return true;
                  return (
                    rec.title.toLowerCase().includes(sq) ||
                    rec.category.toLowerCase().includes(sq) ||
                    rec.status.toLowerCase().includes(sq) ||
                    (rec.receiptNo || '').toLowerCase().includes(sq) ||
                    (rec.transactionRef || '').toLowerCase().includes(sq)
                  );
                })
                .map((rec) => (
                <tr key={rec.id}>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                    {rec.title}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">{rec.category}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {rec.dueDate}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    ₹{rec.amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold">
                    {rec.status === 'PAID' ? (
                      <div>
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Paid ({rec.paidDate})
                        </span>
                        {(rec.paymentMethod || rec.transactionRef) && (
                          <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                            {formatPaymentMethodLabel(rec.paymentMethod)}
                            {rec.transactionRef ? ` · Ref ${rec.transactionRef}` : ''}
                          </div>
                        )}
                      </div>
                    ) : rec.status === 'OVERDUE' ? (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <AlertCircle className="w-3.5 h-3.5" /> Overdue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <Clock className="w-3.5 h-3.5" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {rec.status === 'PAID' ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewReceiptItem(rec)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--sc-primary)] dark:text-blue-400 hover:underline"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          {rec.receiptNo || 'View Receipt'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(rec)}
                          title="Download receipt"
                          className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : user?.role === 'PARENT' ? (
                      <button
                        type="button"
                        onClick={() => setPayingItem(rec)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold hover:opacity-95"
                      >
                        <Smartphone className="w-3.5 h-3.5" /> Pay via UPI / App
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Parent payment pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payingItem && user?.role === 'PARENT' && (
        <ParentFeeCheckoutModal
          item={payingItem}
          studentId={studentId || payingItem.studentId}
          merchantConfig={studentFees.merchantConfig}
          payerDefaults={studentFees.payerDefaults}
          onClose={() => setPayingItem(null)}
          onSuccess={loadFees}
          onDownloadTextReceipt={(rec) => handleDownloadReceipt(rec)}
        />
      )}

      {viewReceiptItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setViewReceiptItem(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold">
                  {schoolSettings?.schoolName || 'Macro Vision Academy Burhanpur'}
                </h3>
                <p className="text-xs text-slate-500">Verified Digital Fee Receipt</p>
              </div>
              <button
                type="button"
                onClick={() => setViewReceiptItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-500">Receipt Number</div>
                <div className="font-mono font-semibold mt-0.5">{viewReceiptItem.receiptNo}</div>
              </div>
              <div>
                <div className="text-slate-500">Amount Paid</div>
                <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm mt-0.5">
                  ₹{viewReceiptItem.amount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Student</div>
                <div className="font-medium mt-0.5">
                  {studentFees.payerDefaults?.studentName || `Student #${viewReceiptItem.studentId}`}{' '}
                  {studentFees.payerDefaults?.studentCode ? `(${studentFees.payerDefaults.studentCode})` : ''}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Fee Item</div>
                <div className="font-medium mt-0.5">
                  {viewReceiptItem.title} ({viewReceiptItem.category})
                </div>
              </div>
              <div>
                <div className="text-slate-500">Payment Method</div>
                <div className="font-medium mt-0.5">
                  {formatPaymentMethodLabel(viewReceiptItem.paymentMethod)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">UTR / Transaction Ref</div>
                <div className="font-mono font-medium mt-0.5">
                  {viewReceiptItem.transactionRef || 'Verified'}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Payer Details</div>
                <div className="font-medium mt-0.5">
                  {viewReceiptItem.payerName || studentFees.payerDefaults?.fullName || 'Parent / Guardian'}
                  {viewReceiptItem.payerPhone ? ` · ${viewReceiptItem.payerPhone}` : ''}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Payment Date</div>
                <div className="font-mono font-medium mt-0.5">{viewReceiptItem.paidDate}</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button
                type="button"
                onClick={() => handleDownloadReceipt(viewReceiptItem)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" /> Download Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PayConfirmModal: React.FC<{
  item: FeeRecordItem;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ item, submitting, onClose, onConfirm }) => (
  <div
    role="dialog"
    aria-modal="true"
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
  >
    <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Confirm School Fee Payment</h3>
        <button type="button" onClick={onClose} className="p-1 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-1.5 text-sm">
        <div className="font-semibold">{item.title}</div>
        <div className="text-xs text-slate-500">
          {item.category} · Due {item.dueDate}
        </div>
        <div className="text-xl font-bold font-mono tabular-nums pt-1">
          ₹{item.amount.toLocaleString()}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onConfirm}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--sc-primary)] text-white disabled:opacity-60"
        >
          {submitting ? 'Processing...' : 'Confirm & Issue Receipt'}
        </button>
      </div>
    </div>
  </div>
);

export const CampusGalleryView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [albumFilter, setAlbumFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<GalleryItem | null>(null);
  const [postOpen, setPostOpen] = useState(false);

  // Post Form
  const [title, setTitle] = useState('');
  const [albumName, setAlbumName] = useState('Science & Robotics');
  const [eventDate, setEventDate] = useState('2026-11-21');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  const canPost = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  const loadGallery = async () => {
    setLoading(true);
    try {
      const rows = await apiFetch<GalleryItem[]>('/api/gallery');
      setItems(rows);
    } catch (err: any) {
      showToast('Failed to load campus gallery', err?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('albumName', albumName);
      formData.append('eventDate', eventDate);
      formData.append('description', description);
      if (imageFile) {
        formData.append('image', imageFile);
      }
      await apiFetch('/api/teacher/gallery', {
        method: 'POST',
        body: formData,
      });
      showToast('Campus Update Published', title);
      setPostOpen(false);
      setTitle('');
      setDescription('');
      setImageFile(null);
      loadGallery();
    } catch (err: any) {
      showToast('Failed to publish photo update', err?.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  const albums = ['ALL', ...Array.from(new Set(items.map((i) => i.albumName)))];
  const visibleItems =
    albumFilter === 'ALL' ? items : items.filter((i) => i.albumName === albumFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Campus Media &amp; Event Gallery
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Moments from exhibitions, sports meets, laboratory showcases, and campus celebrations
          </p>
        </div>

        {canPost && (
          <button
            type="button"
            onClick={() => setPostOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold self-start"
          >
            <Camera className="w-4 h-4" /> Post Campus Update
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        {albums.map((alb) => (
          <button
            key={alb}
            type="button"
            onClick={() => setAlbumFilter(alb)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
              albumFilter === alb
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {alb === 'ALL' ? 'All Albums' : alb}
          </button>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="w-6 h-6" />}
          title="No gallery updates yet"
          description="School function photos and event albums will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleItems.map((item) => (
            <article
              key={item.id}
              onClick={() => setActivePhoto(item)}
              className="cursor-pointer group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:border-[var(--sc-primary)] transition-colors"
            >
              <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                {!brokenImages[item.id] ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onError={() => setBrokenImages((prev) => ({ ...prev, [item.id]: true }))}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 text-slate-500">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                    {item.albumName}
                  </span>
                  <span className="font-mono">{item.eventDate}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                  {item.description}
                </p>
                <div className="pt-1 text-[11px] text-slate-400">
                  Posted by {item.postedByName}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {activePhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setActivePhoto(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-[16/10] bg-slate-900">
              <img
                src={activePhoto.imageUrl}
                alt={activePhoto.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                  {activePhoto.albumName} · {activePhoto.eventDate}
                </span>
                <button
                  type="button"
                  onClick={() => setActivePhoto(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-lg font-bold">{activePhoto.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {activePhoto.description}
              </p>
              <div className="text-xs text-slate-500">
                Published by {activePhoto.postedByName}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teacher/Admin Post Update Modal */}
      {postOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-base font-semibold">Publish Campus Gallery Update</h3>
            <form onSubmit={handlePublish} className="mt-4 space-y-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event or Exhibition Title"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={albumName}
                  onChange={(e) => setAlbumName(e.target.value)}
                  placeholder="Album Name"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
              </div>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the campus highlight..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {imageFile ? imageFile.name : 'Upload JPG/PNG photo (optional)'}
                </span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPostOpen(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--sc-primary)] text-white"
                >
                  {submitting ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
