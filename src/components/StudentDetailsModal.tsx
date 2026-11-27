import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { StudentDetailRecord } from '../types/index.ts';

export interface StudentFormValues {
  fullName: string;
  studentCode: string;
  classId: number;
  rollNumber: number;
  admissionDate: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
  fatherName: string;
  motherName: string;
  guardianPhone: string;
  guardianEmail: string;
  address: string;
  emergencyContact: string;
  previousSchool: string;
  medicalNotes: string;
  houseName: string;
  password?: string;
  portalPassword?: string;
}

interface StudentDetailsModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  role: 'ADMIN' | 'TEACHER';
  student?: StudentDetailRecord | null;
  classes: Array<{ id: number; name: string; section: string }>;
  defaultClassId?: number;
  onClose: () => void;
  onSave: (values: StudentFormValues) => Promise<void>;
}

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['Not specified', 'Male', 'Female', 'Other'];

export const StudentDetailsModal: React.FC<StudentDetailsModalProps> = ({
  open,
  mode,
  role,
  student,
  classes,
  defaultClassId,
  onClose,
  onSave,
}) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<StudentFormValues>({
    fullName: '',
    studentCode: '',
    classId: defaultClassId || classes[0]?.id || 0,
    rollNumber: 1,
    admissionDate: new Date().toISOString().slice(0, 10),
    gender: 'Not specified',
    dateOfBirth: '',
    bloodGroup: '',
    fatherName: '',
    motherName: '',
    guardianPhone: '',
    guardianEmail: '',
    address: '',
    emergencyContact: '',
    previousSchool: '',
    medicalNotes: '',
    houseName: '',
    password: '',
    portalPassword: '',
  });

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && student) {
      setForm({
        fullName: student.fullName || '',
        studentCode: student.studentCode || '',
        classId: student.classId,
        rollNumber: student.rollNumber || 1,
        admissionDate: student.admissionDate || new Date().toISOString().slice(0, 10),
        gender: student.gender || 'Not specified',
        dateOfBirth: student.dateOfBirth || '',
        bloodGroup: student.bloodGroup || '',
        fatherName: student.fatherName || '',
        motherName: student.motherName || '',
        guardianPhone: student.guardianPhone || '',
        guardianEmail: student.guardianEmail || '',
        address: student.address || '',
        emergencyContact: student.emergencyContact || '',
        previousSchool: student.previousSchool || '',
        medicalNotes: student.medicalNotes || '',
        houseName: student.houseName || '',
        password: '',
        portalPassword: '',
      });
    } else {
      setForm({
        fullName: '',
        studentCode: '',
        classId: defaultClassId || classes[0]?.id || 0,
        rollNumber: 1,
        admissionDate: new Date().toISOString().slice(0, 10),
        gender: 'Not specified',
        dateOfBirth: '',
        bloodGroup: '',
        fatherName: '',
        motherName: '',
        guardianPhone: '',
        guardianEmail: '',
        address: '',
        emergencyContact: '',
        previousSchool: '',
        medicalNotes: '',
        houseName: '',
        password: '',
        portalPassword: '',
      });
    }
  }, [open, mode, student, defaultClassId, classes]);

  if (!open) return null;

  const update = <K extends keyof StudentFormValues>(key: K, val: StudentFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl my-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {mode === 'edit' ? `Student Details · ${student?.fullName}` : 'Enroll Student & Full Profile'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'edit'
                ? `Student ID: ${student?.studentCode} · Complete academic, guardian & health information`
                : 'Enter student identity, class roll number, parent/guardian details, and emergency contacts'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Academic & Identity */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              1. Identity &amp; Class Assignment
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                  placeholder="Student Full Name"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Student School ID *
                </label>
                <input
                  type="text"
                  required
                  disabled={mode === 'edit'}
                  value={form.studentCode}
                  onChange={(e) => update('studentCode', e.target.value)}
                  placeholder="STU-10A-001"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60 px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Class &amp; Section *
                </label>
                <select
                  value={form.classId}
                  disabled={mode === 'edit' && role === 'TEACHER'}
                  onChange={(e) => update('classId', Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:opacity-60 px-3 py-2 text-sm"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}-{c.section}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Roll Number *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.rollNumber}
                  onChange={(e) => update('rollNumber', Number(e.target.value) || 1)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => update('dateOfBirth', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Admission Date
                </label>
                <input
                  type="date"
                  value={form.admissionDate}
                  onChange={(e) => update('admissionDate', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Gender
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => update('gender', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Blood Group
                </label>
                <select
                  value={form.bloodGroup}
                  onChange={(e) => update('bloodGroup', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="">Not specified</option>
                  {BLOOD_GROUPS.filter(Boolean).map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  School House
                </label>
                <input
                  type="text"
                  value={form.houseName}
                  onChange={(e) => update('houseName', e.target.value)}
                  placeholder="e.g. Tagore House / Blue"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Family & Emergency Info */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              2. Parent / Guardian &amp; Contact Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Father&apos;s Name
                </label>
                <input
                  type="text"
                  value={form.fatherName}
                  onChange={(e) => update('fatherName', e.target.value)}
                  placeholder="Father Full Name"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Mother&apos;s Name
                </label>
                <input
                  type="text"
                  value={form.motherName}
                  onChange={(e) => update('motherName', e.target.value)}
                  placeholder="Mother Full Name"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Guardian Phone
                </label>
                <input
                  type="text"
                  value={form.guardianPhone}
                  onChange={(e) => update('guardianPhone', e.target.value)}
                  placeholder="+91 98XXXXXXXX"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Emergency Contact
                </label>
                <input
                  type="text"
                  value={form.emergencyContact}
                  onChange={(e) => update('emergencyContact', e.target.value)}
                  placeholder="Name & Phone Number"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Guardian Contact Email (Record Only)
                </label>
                <input
                  type="text"
                  value={form.guardianEmail}
                  onChange={(e) => update('guardianEmail', e.target.value)}
                  placeholder="Optional contact email"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Previous School
                </label>
                <input
                  type="text"
                  value={form.previousSchool}
                  onChange={(e) => update('previousSchool', e.target.value)}
                  placeholder="Transfer / previous school"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="Full home address"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Medical / Health Notes
                </label>
                <input
                  type="text"
                  value={form.medicalNotes}
                  onChange={(e) => update('medicalNotes', e.target.value)}
                  placeholder="Allergies, special care instructions, or health notes"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Student Portal Login Credentials (Admin & Assigned Class Teacher) */}
          {(role === 'ADMIN' || role === 'TEACHER') && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                3. Student Portal Account Credentials (Optional)
              </div>
              <p className="text-xs text-slate-500">
                Student signs into their Student Dashboard using School ID{' '}
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {form.studentCode ? form.studentCode.toUpperCase() : 'STU-...'}
                </span>{' '}
                and this password.
              </p>
              <div className="max-w-sm">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {mode === 'edit'
                    ? student?.hasPortalAccount
                      ? 'Reset Student Portal Password (leave blank to keep current)'
                      : 'Create Student Portal Password (min 8 chars)'
                    : 'Student Portal Password (min 8 chars, optional)'}
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={mode === 'edit' ? form.portalPassword || '' : form.password || ''}
                  onChange={(e) =>
                    mode === 'edit'
                      ? update('portalPassword', e.target.value)
                      : update('password', e.target.value)
                  }
                  placeholder="Min 8 characters"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-[var(--sc-primary)] text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : mode === 'edit' ? 'Save Student Details' : 'Enroll Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
