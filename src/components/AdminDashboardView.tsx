import React, { useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  Building2,
  Edit3,
  GraduationCap,
  KeyRound,
  Link2,
  Palette,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import { AuditLogItem, SchoolSettings, StudentDetailRecord } from '../types/index.ts';
import { StudentDetailsModal, StudentFormValues } from './StudentDetailsModal.tsx';
import { ConfirmDialog, DashboardSkeleton, useToast } from './ui/ToastAndModal.tsx';

export type AdminSectionId =
  | 'overview'
  | 'students'
  | 'parents'
  | 'classes'
  | 'users'
  | 'activity'
  | 'branding';

interface AdminOverviewData {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalParents: number;
    totalClasses: number;
    totalSubjects: number;
    schoolAvgPct: number;
    schoolAttendancePct: number;
  };
  classBreakdown: Array<{
    classId: number;
    className: string;
    section: string;
    roomNumber: string | null;
    classTeacherId: number | null;
    classTeacherName: string | null;
    studentCount: number;
  }>;
  recentLogs: AuditLogItem[];
  settings: SchoolSettings | null;
}

interface AdminUserRow {
  id: number;
  username: string | null;
  email: string | null;
  fullName: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface AdminClassRow {
  id: number;
  name: string;
  section: string;
  roomNumber: string | null;
  classTeacherId: number | null;
  classTeacherName: string | null;
}

interface ParentLinkRow {
  id: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  className: string;
  section: string;
  parentId: number;
  parentName: string;
  parentUsername: string | null;
  parentPhone: string | null;
  relationship: string;
}

export const AdminDashboardView: React.FC<{
  initialSection?: AdminSectionId;
  aiCommand?: {
    section: AdminSectionId;
    query?: string;
    roleFilter?: 'ALL' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';
    nonce: number;
  } | null;
}> = ({ initialSection = 'overview', aiCommand }) => {
  const { refreshSchoolSettings } = useAuth();
  const { showToast } = useToast();
  const [section, setSection] = useState<AdminSectionId>(initialSection);
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [classesData, setClassesData] = useState<{
    classes: AdminClassRow[];
    assignments: Array<{
      id: number;
      classId: number;
      subjectId: number;
      subjectName: string;
      teacherId: number;
      teacherName: string;
    }>;
  }>({ classes: [], assignments: [] });
  const [subjectsList, setSubjectsList] = useState<
    Array<{ id: number; name: string; code: string; department: string }>
  >([]);
  const [studentsList, setStudentsList] = useState<StudentDetailRecord[]>([]);
  const [parentLinks, setParentLinks] = useState<ParentLinkRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Student Enrollment modal & filters
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState<'create' | 'edit'>('create');
  const [editingStudent, setEditingStudent] = useState<StudentDetailRecord | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState<number>(0);

  // Directory Search filters
  const [overviewClassSearch, setOverviewClassSearch] = useState('');
  const [parentLinkSearch, setParentLinkSearch] = useState('');
  const [parentAccountSearch, setParentAccountSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [allocationSearch, setAllocationSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');

  // Parent Enrollment & Linking
  const [parName, setParName] = useState('');
  const [parUsername, setParUsername] = useState('');
  const [parPassword, setParPassword] = useState('');
  const [parPhone, setParPhone] = useState('');
  const [parRelationship, setParRelationship] = useState('Parent');
  const [parChildIds, setParChildIds] = useState<number[]>([]);
  const [linkParentId, setLinkParentId] = useState(0);
  const [linkStudentId, setLinkStudentId] = useState(0);
  const [linkRelationship, setLinkRelationship] = useState('Parent');

  // Classes & Subjects & Homeroom Assignment
  const [clsName, setClsName] = useState('');
  const [clsSection, setClsSection] = useState('');
  const [clsRoom, setClsRoom] = useState('101');
  const [clsTeacherId, setClsTeacherId] = useState<number>(0);
  const [classTeacherDrafts, setClassTeacherDrafts] = useState<Record<number, number>>({});
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [assignClassId, setAssignClassId] = useState(0);
  const [assignSubjectId, setAssignSubjectId] = useState(0);
  const [assignTeacherId, setAssignTeacherId] = useState(0);

  // New Account Form (Faculty / RBAC)
  const [newName, setNewName] = useState('');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'TEACHER' | 'PARENT' | 'STUDENT'>('TEACHER');

  // Activity Log filter
  const [activityFilter, setActivityFilter] = useState('');

  // Branding settings
  const [branding, setBranding] = useState<SchoolSettings | null>(null);

  // Confirm Dialog state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // Edit User / Faculty Modal
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserRole, setEditUserRole] = useState<'TEACHER' | 'PARENT' | 'STUDENT'>('TEACHER');
  const [editUserActive, setEditUserActive] = useState(true);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [savingEditUser, setSavingEditUser] = useState(false);

  // Edit Class Modal
  const [editingClass, setEditingClass] = useState<AdminClassRow | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassSection, setEditClassSection] = useState('');
  const [editClassRoom, setEditClassRoom] = useState('101');
  const [editClassTeacherId, setEditClassTeacherId] = useState<number>(0);
  const [savingEditClass, setSavingEditClass] = useState(false);

  // Edit Subject Modal
  const [editingSubject, setEditingSubject] = useState<{
    id: number;
    name: string;
    code: string;
    department: string;
  } | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubCode, setEditSubCode] = useState('');
  const [editSubDept, setEditSubDept] = useState('General');
  const [savingEditSub, setSavingEditSub] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ov, usr, cls, subs, stus, logs] = await Promise.all([
        apiFetch<AdminOverviewData>('/api/admin/overview'),
        apiFetch<AdminUserRow[]>('/api/admin/users'),
        apiFetch<typeof classesData>('/api/admin/classes'),
        apiFetch<typeof subjectsList>('/api/admin/subjects'),
        apiFetch<{ students: StudentDetailRecord[]; parentLinks: ParentLinkRow[] }>(
          '/api/admin/students'
        ),
        apiFetch<AuditLogItem[]>('/api/admin/audit-logs'),
      ]);
      setOverview(ov);
      setBranding(ov.settings);
      setUsersList(usr);
      setClassesData(cls);
      setSubjectsList(subs);
      setStudentsList(stus.students);
      setParentLinks(stus.parentLinks);
      setAuditLogs(logs);

      const drafts: Record<number, number> = {};
      for (const c of cls.classes) {
        drafts[c.id] = c.classTeacherId || 0;
      }
      setClassTeacherDrafts(drafts);

      const firstParent = usr.find((u) => u.role === 'PARENT');
      const firstTeacher = usr.find((u) => u.role === 'TEACHER');
      if (firstParent && !linkParentId) setLinkParentId(firstParent.id);
      if (stus.students[0] && !linkStudentId) setLinkStudentId(stus.students[0].id);
      if (cls.classes[0] && !assignClassId) setAssignClassId(cls.classes[0].id);
      if (subs[0] && !assignSubjectId) setAssignSubjectId(subs[0].id);
      if (firstTeacher && !assignTeacherId) setAssignTeacherId(firstTeacher.id);
    } catch (err: any) {
      showToast('Admin load failed', err?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!aiCommand) return;
    if (aiCommand.section === 'students' && aiCommand.query !== undefined) {
      setStudentSearch(aiCommand.query);
    } else if (aiCommand.section === 'activity' && aiCommand.query !== undefined) {
      setActivityFilter(aiCommand.query);
    } else if (aiCommand.section === 'users') {
      if (aiCommand.roleFilter) setRoleFilter(aiCommand.roleFilter);
      if (aiCommand.query !== undefined) setUserSearch(aiCommand.query);
    }
  }, [aiCommand?.nonce]);

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveStudent = async (values: StudentFormValues) => {
    try {
      if (studentModalMode === 'create') {
        await apiFetch('/api/admin/students', {
          method: 'POST',
          body: JSON.stringify({
            ...values,
            password: values.password || undefined,
          }),
        });
        showToast('Student Enrolled', `${values.fullName} (${values.studentCode.toUpperCase()}) added.`);
      } else if (editingStudent) {
        await apiFetch(`/api/admin/students/${editingStudent.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...values,
            portalPassword: values.portalPassword || undefined,
          }),
        });
        showToast('Student Updated', `${values.fullName} details saved.`);
      }
      setStudentModalOpen(false);
      setEditingStudent(null);
      loadAll();
    } catch (err: any) {
      showToast('Student save failed', err?.message, 'error');
    }
  };

  const handleEnrollParent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/parents', {
        method: 'POST',
        body: JSON.stringify({
          fullName: parName,
          username: parUsername,
          password: parPassword,
          phone: parPhone,
          relationship: parRelationship,
          studentIds: parChildIds,
        }),
      });
      showToast(
        'Parent Enrolled',
        `${parName} (${parUsername.toUpperCase()}) enrolled${parChildIds.length > 0 ? ` and linked to ${parChildIds.length} child(ren)` : ''}.`
      );
      setParName('');
      setParUsername('');
      setParPassword('');
      setParPhone('');
      setParChildIds([]);
      loadAll();
    } catch (err: any) {
      showToast('Parent enrollment failed', err?.message, 'error');
    }
  };

  const handleLinkParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkParentId || !linkStudentId) {
      showToast('Selection Required', 'Select both a parent and a student.', 'error');
      return;
    }
    try {
      await apiFetch('/api/admin/parent-links', {
        method: 'POST',
        body: JSON.stringify({
          parentId: linkParentId,
          studentId: linkStudentId,
          relationship: linkRelationship || 'Parent',
        }),
      });
      showToast('Parent Linked', 'Parent can now view this child’s portal.');
      loadAll();
    } catch (err: any) {
      showToast('Link failed', err?.message, 'error');
    }
  };

  const handleUnlinkParent = async (linkId: number) => {
    try {
      await apiFetch(`/api/admin/parent-links/${linkId}`, { method: 'DELETE' });
      showToast('Link Removed', 'Parent-student link removed.');
      loadAll();
    } catch (err: any) {
      showToast('Unlink failed', err?.message, 'error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newName,
          username: newIdentifier,
          password: newPassword,
          phone: newPhone || undefined,
          role: newRole,
        }),
      });
      showToast('Account Created', `${newRole} account ready for ${newIdentifier.toUpperCase()}`);
      setNewName('');
      setNewIdentifier('');
      setNewPassword('');
      setNewPhone('');
      loadAll();
    } catch (err: any) {
      showToast('Failed to create account', err?.message, 'error');
    }
  };

  const toggleUserActive = async (u: AdminUserRow) => {
    try {
      await apiFetch(`/api/admin/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      showToast(u.isActive ? 'Account Disabled' : 'Account Enabled', u.fullName);
      loadAll();
    } catch (err: any) {
      showToast('Action failed', err?.message, 'error');
    }
  };

  const resetUserPassword = async (u: AdminUserRow) => {
    try {
      await apiFetch(`/api/admin/users/${u.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: 'Reset@2026!' }),
      });
      showToast('Access Reset', `Temporary credentials issued for ${u.username || u.email} (Reset@2026!)`, 'info');
    } catch (err: any) {
      showToast('Reset failed', err?.message, 'error');
    }
  };

  const openEditUserModal = (u: AdminUserRow) => {
    setEditingUser(u);
    setEditUserName(u.fullName);
    setEditUserUsername(u.username || '');
    setEditUserPhone(u.phone || '');
    setEditUserRole(
      u.role === 'PARENT' || u.role === 'STUDENT' ? u.role : 'TEACHER'
    );
    setEditUserActive(u.isActive);
    setEditUserPassword('');
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEditUser(true);
    try {
      await apiFetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editUserName,
          username: editUserUsername,
          phone: editUserPhone,
          role: editUserRole,
          isActive: editUserActive,
          ...(editUserPassword.trim() ? { password: editUserPassword } : {}),
        }),
      });
      showToast('Account Updated', `${editUserName} (${editUserUsername.toUpperCase()}) updated.`);
      setEditingUser(null);
      loadAll();
    } catch (err: any) {
      showToast('Update failed', err?.message, 'error');
    } finally {
      setSavingEditUser(false);
    }
  };

  const requestDeleteUser = (u: AdminUserRow) => {
    setConfirmState({
      open: true,
      title: `Delete ${u.role} Account`,
      description: `Are you sure you want to delete ${u.fullName} (${u.username || u.email || 'ID #' + u.id})? Any class homeroom or timetable assignments for this user will be cleared.`,
      confirmLabel: 'Delete Account',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await apiFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
          showToast('Account Deleted', `${u.fullName} has been removed.`);
          loadAll();
        } catch (err: any) {
          showToast('Delete failed', err?.message, 'error');
        }
      },
    });
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/classes', {
        method: 'POST',
        body: JSON.stringify({
          name: clsName,
          section: clsSection,
          roomNumber: clsRoom || '101',
          classTeacherId: clsTeacherId || null,
        }),
      });
      showToast('Class Created', `${clsName}-${clsSection.toUpperCase()}`);
      setClsName('');
      setClsSection('');
      setClsRoom('101');
      setClsTeacherId(0);
      loadAll();
    } catch (err: any) {
      showToast('Class creation failed', err?.message, 'error');
    }
  };

  const handleAssignClassTeacher = async (classId: number) => {
    try {
      const teacherId = classTeacherDrafts[classId] || null;
      await apiFetch(`/api/admin/classes/${classId}`, {
        method: 'PATCH',
        body: JSON.stringify({ classTeacherId: teacherId }),
      });
      showToast('Class Teacher Saved', teacherId ? 'Homeroom class assigned to teacher.' : 'Class Teacher unassigned.');
      loadAll();
    } catch (err: any) {
      showToast('Assignment failed', err?.message, 'error');
    }
  };

  const openEditClassModal = (c: AdminClassRow) => {
    setEditingClass(c);
    setEditClassName(c.name);
    setEditClassSection(c.section);
    setEditClassRoom(c.roomNumber || '101');
    setEditClassTeacherId(c.classTeacherId || 0);
  };

  const handleSaveClassEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setSavingEditClass(true);
    try {
      await apiFetch(`/api/admin/classes/${editingClass.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editClassName,
          section: editClassSection,
          roomNumber: editClassRoom || '101',
          classTeacherId: editClassTeacherId || null,
        }),
      });
      showToast('Class Updated', `${editClassName}-${editClassSection.toUpperCase()} saved.`);
      setEditingClass(null);
      loadAll();
    } catch (err: any) {
      showToast('Class update failed', err?.message, 'error');
    } finally {
      setSavingEditClass(false);
    }
  };

  const requestDeleteClass = (c: AdminClassRow) => {
    setConfirmState({
      open: true,
      title: `Delete ${c.name}-${c.section}`,
      description: `Are you sure you want to delete ${c.name}-${c.section} (Room ${c.roomNumber || '101'})? Classes with enrolled students cannot be deleted until students are moved or removed.`,
      confirmLabel: 'Delete Class',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await apiFetch(`/api/admin/classes/${c.id}`, { method: 'DELETE' });
          showToast('Class Deleted', `${c.name}-${c.section} removed.`);
          loadAll();
        } catch (err: any) {
          showToast('Delete failed', err?.message, 'error');
        }
      },
    });
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/subjects', {
        method: 'POST',
        body: JSON.stringify({ name: subName, code: subCode }),
      });
      showToast('Subject Created', subName);
      setSubName('');
      setSubCode('');
      loadAll();
    } catch (err: any) {
      showToast('Subject creation failed', err?.message, 'error');
    }
  };

  const openEditSubjectModal = (sub: { id: number; name: string; code: string; department: string }) => {
    setEditingSubject(sub);
    setEditSubName(sub.name);
    setEditSubCode(sub.code);
    setEditSubDept(sub.department || 'General');
  };

  const handleSaveSubjectEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    setSavingEditSub(true);
    try {
      await apiFetch(`/api/admin/subjects/${editingSubject.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editSubName,
          code: editSubCode,
          department: editSubDept || 'General',
        }),
      });
      showToast('Subject Updated', `${editSubName} (${editSubCode.toUpperCase()}) saved.`);
      setEditingSubject(null);
      loadAll();
    } catch (err: any) {
      showToast('Subject update failed', err?.message, 'error');
    } finally {
      setSavingEditSub(false);
    }
  };

  const requestDeleteSubject = (sub: { id: number; name: string; code: string }) => {
    setConfirmState({
      open: true,
      title: `Delete Subject ${sub.name}`,
      description: `Delete subject ${sub.name} (${sub.code})? Subjects referenced by marks, homework, notes, or timetables cannot be deleted.`,
      confirmLabel: 'Delete Subject',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await apiFetch(`/api/admin/subjects/${sub.id}`, { method: 'DELETE' });
          showToast('Subject Deleted', `${sub.name} removed.`);
          loadAll();
        } catch (err: any) {
          showToast('Delete failed', err?.message, 'error');
        }
      },
    });
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClassId || !assignSubjectId || !assignTeacherId) {
      showToast('Selection Required', 'Select class, subject, and teacher.', 'error');
      return;
    }
    try {
      await apiFetch('/api/admin/class-subjects', {
        method: 'POST',
        body: JSON.stringify({
          classId: assignClassId,
          subjectId: assignSubjectId,
          teacherId: assignTeacherId,
        }),
      });
      showToast('Subject Teacher Assigned', 'Class & subject allocation updated.');
      loadAll();
    } catch (err: any) {
      showToast('Assignment failed', err?.message, 'error');
    }
  };

  const requestDeleteClassSubject = (assignmentId: number, label: string) => {
    setConfirmState({
      open: true,
      title: 'Remove Subject Teacher Assignment',
      description: `Remove ${label} from subject allocations?`,
      confirmLabel: 'Remove Allocation',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await apiFetch(`/api/admin/class-subjects/${assignmentId}`, { method: 'DELETE' });
          showToast('Allocation Removed', `${label} unassigned.`);
          loadAll();
        } catch (err: any) {
          showToast('Remove failed', err?.message, 'error');
        }
      },
    });
  };

  const requestDeleteStudent = (s: StudentDetailRecord) => {
    setConfirmState({
      open: true,
      title: `Delete Student ${s.fullName}`,
      description: `Permanently delete ${s.fullName} (${s.studentCode}) along with their marks, attendance, fees, and parent links?`,
      confirmLabel: 'Delete Student',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await apiFetch(`/api/admin/students/${s.id}`, { method: 'DELETE' });
          showToast('Student Deleted', `${s.fullName} removed.`);
          loadAll();
        } catch (err: any) {
          showToast('Delete failed', err?.message, 'error');
        }
      },
    });
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branding) return;
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(branding),
      });
      await refreshSchoolSettings();
      showToast('School Branding Updated', 'Theme colors and school details applied.');
    } catch (err: any) {
      showToast('Update failed', err?.message, 'error');
    }
  };

  if (loading || !overview) return <DashboardSkeleton />;

  const parentsList = usersList.filter((u) => u.role === 'PARENT');
  const teachersList = usersList.filter((u) => u.role === 'TEACHER');

  const assignedClassByTeacherId = new Map<number, string>();
  for (const c of classesData.classes) {
    if (c.classTeacherId) {
      assignedClassByTeacherId.set(c.classTeacherId, `${c.name}-${c.section}`);
    }
  }

  const filteredUsers = usersList.filter((u) => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const q = userSearch.trim().toLowerCase();
    const assignedCls = u.role === 'TEACHER' ? assignedClassByTeacherId.get(u.id) || '' : '';
    const matchesQuery =
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      assignedCls.toLowerCase().includes(q);
    return matchesRole && matchesQuery;
  });

  const filteredStudents = studentsList.filter((s) => {
    const matchesClass = !studentClassFilter || s.classId === studentClassFilter;
    const q = studentSearch.trim().toLowerCase();
    const clsLabel = `${s.className}-${s.section}`.toLowerCase();
    const matchesQuery =
      !q ||
      s.fullName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      clsLabel.includes(q) ||
      String(s.rollNumber).includes(q) ||
      (s.fatherName || '').toLowerCase().includes(q) ||
      (s.motherName || '').toLowerCase().includes(q) ||
      (s.guardianPhone || '').toLowerCase().includes(q);
    return matchesClass && matchesQuery;
  });

  const filteredOverviewClasses = overview.classBreakdown.filter((c) => {
    const q = overviewClassSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      `${c.className}-${c.section}`.toLowerCase().includes(q) ||
      (c.roomNumber || '').toLowerCase().includes(q) ||
      (c.classTeacherName || '').toLowerCase().includes(q)
    );
  });

  const filteredParentLinks = parentLinks.filter((pl) => {
    const q = parentLinkSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      pl.studentName.toLowerCase().includes(q) ||
      pl.studentCode.toLowerCase().includes(q) ||
      `${pl.className}-${pl.section}`.toLowerCase().includes(q) ||
      pl.parentName.toLowerCase().includes(q) ||
      (pl.parentUsername || '').toLowerCase().includes(q) ||
      (pl.parentPhone || '').toLowerCase().includes(q) ||
      pl.relationship.toLowerCase().includes(q)
    );
  });

  const filteredParentsList = parentsList.filter((p) => {
    const q = parentAccountSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.fullName.toLowerCase().includes(q) ||
      (p.username || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q)
    );
  });

  const filteredClassesList = classesData.classes.filter((c) => {
    const q = classSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      `${c.name}-${c.section}`.toLowerCase().includes(q) ||
      (c.roomNumber || '').toLowerCase().includes(q) ||
      (c.classTeacherName || '').toLowerCase().includes(q)
    );
  });

  const filteredAllocations = classesData.assignments.filter((a) => {
    const q = allocationSearch.trim().toLowerCase();
    if (!q) return true;
    const clsObj = classesData.classes.find((c) => c.id === a.classId);
    const clsLabel = clsObj ? `${clsObj.name}-${clsObj.section}` : `Class #${a.classId}`;
    return (
      a.teacherName.toLowerCase().includes(q) ||
      a.subjectName.toLowerCase().includes(q) ||
      clsLabel.toLowerCase().includes(q)
    );
  });

  const filteredSubjects = subjectsList.filter((sub) => {
    const q = subjectSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      sub.name.toLowerCase().includes(q) ||
      sub.code.toLowerCase().includes(q) ||
      (sub.department || '').toLowerCase().includes(q)
    );
  });

  const filteredAuditLogs = auditLogs.filter((log) => {
    const q = activityFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      log.actorName.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            School Administration
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Systematic enrollment for classes, students, parents, teacher assignments, and activity logs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'classes', label: 'Classes & Teachers' },
            { id: 'students', label: 'Student Enrollment' },
            { id: 'parents', label: 'Parent Enrollment' },
            { id: 'users', label: 'Faculty & Accounts' },
            { id: 'activity', label: 'Activity Logs' },
            { id: 'branding', label: 'Branding' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id as AdminSectionId)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                section === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW SECTION */}
      {section === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="text-xs text-slate-500">Enrolled Students</div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums">
                {overview.stats.totalStudents}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="text-xs text-slate-500">Faculty Teachers</div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums">
                {overview.stats.totalTeachers}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="text-xs text-slate-500">Parent Accounts</div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums">
                {overview.stats.totalParents}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="text-xs text-slate-500">Classes · Attendance / Avg</div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums">
                {overview.stats.totalClasses} · {overview.stats.schoolAttendancePct}%
              </div>
            </div>
          </div>

          {/* Systematic Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setSection('classes')}
              className="flex items-center gap-2.5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[var(--sc-primary)] text-left transition-colors"
            >
              <Building2 className="w-5 h-5 text-[var(--sc-primary)] shrink-0" />
              <div>
                <div className="text-sm font-semibold">Classes &amp; Teachers</div>
                <div className="text-xs text-slate-500">Assign 1 class per teacher</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSection('students')}
              className="flex items-center gap-2.5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[var(--sc-primary)] text-left transition-colors"
            >
              <GraduationCap className="w-5 h-5 text-[var(--sc-primary)] shrink-0" />
              <div>
                <div className="text-sm font-semibold">Student Enrollment</div>
                <div className="text-xs text-slate-500">Add &amp; manage student details</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSection('parents')}
              className="flex items-center gap-2.5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[var(--sc-primary)] text-left transition-colors"
            >
              <UserPlus className="w-5 h-5 text-[var(--sc-primary)] shrink-0" />
              <div>
                <div className="text-sm font-semibold">Parent Enrollment</div>
                <div className="text-xs text-slate-500">Create accounts &amp; link children</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSection('activity')}
              className="flex items-center gap-2.5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[var(--sc-primary)] text-left transition-colors"
            >
              <Activity className="w-5 h-5 text-[var(--sc-primary)] shrink-0" />
              <div>
                <div className="text-sm font-semibold">Activity Logs</div>
                <div className="text-xs text-slate-500">Track all portal actions</div>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold inline-flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  Classes, Class Teachers &amp; Enrollment
                </h2>
                <button
                  type="button"
                  onClick={() => setSection('classes')}
                  className="text-xs font-semibold text-[var(--sc-primary)] hover:underline"
                >
                  Manage
                </button>
              </div>
              {overview.classBreakdown.length > 0 && (
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="search"
                    value={overviewClassSearch}
                    onChange={(e) => setOverviewClassSearch(e.target.value)}
                    placeholder="Search class, room, or teacher..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs"
                  />
                </div>
              )}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                {overview.classBreakdown.length === 0 ? (
                  <p className="py-6 text-xs text-slate-500 text-center">
                    No classes created yet. Go to Classes &amp; Teachers to set up classes and assign teachers.
                  </p>
                ) : filteredOverviewClasses.length === 0 ? (
                  <p className="py-6 text-xs text-slate-500 text-center">
                    No classes or teachers match &ldquo;{overviewClassSearch}&rdquo;.
                  </p>
                ) : (
                  filteredOverviewClasses.map((c) => (
                    <div
                      key={c.classId}
                      className="py-2.5 flex items-center justify-between text-sm gap-3"
                    >
                      <div>
                        <span className="font-medium">
                          {c.className}-{c.section}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          Room {c.roomNumber || '101'}
                        </span>
                        <div className="text-xs text-slate-500">
                          Class Teacher: {c.classTeacherName || 'Unassigned'}
                        </div>
                      </div>
                      <span className="font-mono tabular-nums font-semibold whitespace-nowrap">
                        {c.studentCount} students
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold inline-flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-500" />
                  Recent Activity
                </h2>
                <button
                  type="button"
                  onClick={() => setSection('activity')}
                  className="text-xs font-semibold text-[var(--sc-primary)] hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {overview.recentLogs.length === 0 ? (
                  <p className="py-6 text-xs text-slate-500 text-center">
                    No system activity recorded yet.
                  </p>
                ) : (
                  overview.recentLogs.slice(0, 6).map((l) => (
                    <div key={l.id} className="py-2 text-xs space-y-0.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {l.details}
                      </div>
                      <div className="text-slate-500 font-mono">
                        {l.actorRole} · {new Date(l.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT ENROLLMENT SECTION */}
      {section === 'students' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Student Enrollment &amp; Detailed Profiles
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enroll students with full academic, family, guardian phone, address, and health details
              </p>
            </div>
            <button
              type="button"
              disabled={classesData.classes.length === 0}
              onClick={() => {
                setStudentModalMode('create');
                setEditingStudent(null);
                setStudentModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--sc-primary)] text-white text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Enroll New Student
            </button>
          </div>

          {classesData.classes.length === 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
              <span>Create at least one class in Classes &amp; Teachers before enrolling students.</span>
              <button
                type="button"
                onClick={() => setSection('classes')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold shrink-0"
              >
                Create Class
              </button>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by student name, Student ID, class, roll #, father/mother name, or phone..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm"
              />
            </div>
            <select
              value={studentClassFilter}
              onChange={(e) => setStudentClassFilter(Number(e.target.value))}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value={0}>All Classes ({studentsList.length})</option>
              {classesData.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}-{c.section}
                </option>
              ))}
            </select>
            <span className="text-xs font-mono text-slate-500 whitespace-nowrap">
              Showing {filteredStudents.length} of {studentsList.length}
            </span>
          </div>

          {/* Students Directory Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Class &amp; Roll</th>
                    <th className="py-3 px-4">Father / Guardian</th>
                    <th className="py-3 px-4">Phone &amp; DOB</th>
                    <th className="py-3 px-4">Portal</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                        {studentsList.length === 0
                          ? 'No students enrolled yet. Click "Enroll New Student" to add student records.'
                          : 'No enrolled students match your current search or class filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono text-xs font-semibold">{s.studentCode}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{s.fullName}</div>
                          <div className="text-xs text-slate-500">
                            {s.gender || 'Not specified'}
                            {s.bloodGroup ? ` · ${s.bloodGroup}` : ''}
                            {s.houseName ? ` · ${s.houseName}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="font-semibold">
                            {s.className}-{s.section}
                          </span>
                          <div className="font-mono text-slate-500">Roll #{s.rollNumber}</div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div>{s.fatherName || '—'}</div>
                          {s.motherName && <div className="text-slate-500">M: {s.motherName}</div>}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono">
                          <div>{s.guardianPhone || 'No phone'}</div>
                          <div className="text-slate-500">{s.dateOfBirth || 'DOB unset'}</div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {s.hasPortalAccount ? (
                            <span className="text-emerald-600 font-semibold">Enabled</span>
                          ) : (
                            <span className="text-slate-400">Record Only</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
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
                          <button
                            type="button"
                            onClick={() => requestDeleteStudent(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PARENT ENROLLMENT & LINKING SECTION */}
      {section === 'parents' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleEnrollParent}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <div>
                <h2 className="text-sm font-semibold inline-flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[var(--sc-primary)]" />
                  Enroll New Parent Account
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create a Parent School ID account and optionally link their child(ren) in one step
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={parName}
                  onChange={(e) => setParName(e.target.value)}
                  placeholder="Parent Full Name"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  value={parUsername}
                  onChange={(e) => setParUsername(e.target.value)}
                  placeholder="Parent ID (e.g. PAR-101)"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={parPassword}
                  onChange={(e) => setParPassword(e.target.value)}
                  placeholder="Password (min 8 chars)"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={parPhone}
                  onChange={(e) => setParPhone(e.target.value)}
                  placeholder="Phone Number (optional)"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Relationship
                  </label>
                  <select
                    value={parRelationship}
                    onChange={(e) => setParRelationship(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="Parent">Parent</option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Link Child (Optional)
                  </label>
                  <select
                    value={parChildIds[0] || 0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setParChildIds(val ? [val] : []);
                    }}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value={0}>Link later / select student</option>
                    {studentsList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.studentCode} · {s.className}-{s.section})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white"
              >
                <Plus className="w-3.5 h-3.5" /> Enroll Parent Account
              </button>
            </form>

            <form
              onSubmit={handleLinkParent}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <div>
                <h2 className="text-sm font-semibold inline-flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[var(--sc-primary)]" />
                  Connect Existing Parent to Student
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Link additional children or assign an existing parent to an enrolled student
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Parent Account
                  </label>
                  <select
                    value={linkParentId}
                    onChange={(e) => setLinkParentId(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    {parentsList.length === 0 ? (
                      <option value={0}>No parent accounts yet</option>
                    ) : (
                      parentsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName} ({p.username || p.email})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Enrolled Student
                  </label>
                  <select
                    value={linkStudentId}
                    onChange={(e) => setLinkStudentId(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    {studentsList.length === 0 ? (
                      <option value={0}>No students enrolled yet</option>
                    ) : (
                      studentsList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName} ({s.studentCode} · {s.className}-{s.section})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Relationship
                  </label>
                  <select
                    value={linkRelationship}
                    onChange={(e) => setLinkRelationship(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="Parent">Parent</option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white"
              >
                <Link2 className="w-3.5 h-3.5" /> Connect Parent &amp; Student
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Linked Parents &amp; Students Directory</h3>
                <span className="text-xs font-mono text-slate-500">
                  Showing {filteredParentLinks.length} of {parentLinks.length} links
                </span>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="search"
                  value={parentLinkSearch}
                  onChange={(e) => setParentLinkSearch(e.target.value)}
                  placeholder="Search student name, ID, class, or parent..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Parent Name</th>
                    <th className="py-3 px-4">Parent ID</th>
                    <th className="py-3 px-4">Relationship</th>
                    <th className="py-3 px-4">Linked Student</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredParentLinks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                        {parentLinks.length === 0
                          ? 'No parent-student links configured yet.'
                          : 'No linked parent-student records match your search.'}
                      </td>
                    </tr>
                  ) : (
                    filteredParentLinks.map((pl) => (
                      <tr key={pl.id}>
                        <td className="py-3 px-4 font-medium">{pl.parentName}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">
                          {pl.parentUsername || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs">{pl.relationship}</td>
                        <td className="py-3 px-4">
                          <span className="font-medium">{pl.studentName}</span>
                          <span className="ml-2 font-mono text-xs text-slate-500">
                            {pl.studentCode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {pl.className}-{pl.section}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleUnlinkParent(pl.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Unlink
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Enrolled Parent Accounts</h3>
                <span className="text-xs font-mono text-slate-500">
                  Showing {filteredParentsList.length} of {parentsList.length} parents
                </span>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="search"
                  value={parentAccountSearch}
                  onChange={(e) => setParentAccountSearch(e.target.value)}
                  placeholder="Search parent name, ID, or phone..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Parent Name</th>
                    <th className="py-3 px-4">Parent ID</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredParentsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-slate-500">
                        {parentsList.length === 0
                          ? 'No parent accounts enrolled yet.'
                          : 'No parent accounts match your search.'}
                      </td>
                    </tr>
                  ) : (
                    filteredParentsList.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 px-4 font-medium">{p.fullName}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">
                          {p.username || p.email || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">
                          {p.phone || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {p.isActive ? (
                            <span className="text-emerald-600 font-semibold">Active</span>
                          ) : (
                            <span className="text-red-600 font-semibold">Disabled</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditUserModal(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteUser(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CLASSES, CLASS TEACHERS & SUBJECTS SECTION */}
      {section === 'classes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleCreateClass}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
            >
              <div>
                <h3 className="text-sm font-semibold">Create Class &amp; Assign Homeroom Teacher</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Each teacher manages one assigned class where they enter &amp; maintain student details
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={clsName}
                  onChange={(e) => setClsName(e.target.value)}
                  placeholder="Class 8"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  value={clsSection}
                  onChange={(e) => setClsSection(e.target.value)}
                  placeholder="Section (e.g. A)"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={clsRoom}
                  onChange={(e) => setClsRoom(e.target.value)}
                  placeholder="Room # (e.g. 101)"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Assigned Class Teacher (1 Class per Teacher)
                </label>
                <select
                  value={clsTeacherId}
                  onChange={(e) => setClsTeacherId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value={0}>Assign later</option>
                  {teachersList.map((t) => {
                    const existingCls = assignedClassByTeacherId.get(t.id);
                    return (
                      <option key={t.id} value={t.id} disabled={Boolean(existingCls)}>
                        {t.fullName} ({t.username})
                        {existingCls ? ` — Assigned to ${existingCls}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white"
              >
                Create Class
              </button>
            </form>

            <form
              onSubmit={handleCreateSubject}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
            >
              <div>
                <h3 className="text-sm font-semibold inline-flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-500" />
                  Create Subject
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add academic subjects for marks, homework, notes, and timetables
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Mathematics"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="MATH"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white"
              >
                Add Subject
              </button>
            </form>
          </div>

          {/* Class Teacher Assignment Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Class &amp; Homeroom Teacher Directory</h3>
                <p className="text-xs text-slate-500">
                  Assign or update each class&apos;s Class Teacher · Showing {filteredClassesList.length} of {classesData.classes.length}
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="search"
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="Search class, room, or teacher..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Class &amp; Section</th>
                    <th className="py-3 px-4">Room</th>
                    <th className="py-3 px-4">Assigned Class Teacher</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredClassesList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                        {classesData.classes.length === 0
                          ? 'No classes created yet.'
                          : 'No classes or teachers match your search.'}
                      </td>
                    </tr>
                  ) : (
                    filteredClassesList.map((c) => (
                      <tr key={c.id}>
                        <td className="py-3 px-4 font-semibold">
                          {c.name}-{c.section}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          Room {c.roomNumber || '101'}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={classTeacherDrafts[c.id] || 0}
                            onChange={(e) =>
                              setClassTeacherDrafts((prev) => ({
                                ...prev,
                                [c.id]: Number(e.target.value),
                              }))
                            }
                            className="w-full max-w-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                          >
                            <option value={0}>Unassigned</option>
                            {teachersList.map((t) => {
                              const otherClass = assignedClassByTeacherId.get(t.id);
                              const takenElsewhere = Boolean(
                                otherClass && c.classTeacherId !== t.id
                              );
                              return (
                                <option key={t.id} value={t.id} disabled={takenElsewhere}>
                                  {t.fullName} ({t.username})
                                  {takenElsewhere ? ` — Assigned to ${otherClass}` : ''}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleAssignClassTeacher(c.id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white"
                          >
                            Save Teacher
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditClassModal(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteClass(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subject Teacher Allocation */}
          <form
            onSubmit={handleAssignTeacher}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold">Assign Subject Teacher to Class</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={assignClassId}
                onChange={(e) => setAssignClassId(Number(e.target.value))}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {classesData.classes.length === 0 ? (
                  <option value={0}>Create class first</option>
                ) : (
                  classesData.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}-{c.section}
                    </option>
                  ))
                )}
              </select>
              <select
                value={assignSubjectId}
                onChange={(e) => setAssignSubjectId(Number(e.target.value))}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {subjectsList.length === 0 ? (
                  <option value={0}>Create subject first</option>
                ) : (
                  subjectsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>
              <select
                value={assignTeacherId}
                onChange={(e) => setAssignTeacherId(Number(e.target.value))}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {teachersList.length === 0 ? (
                  <option value={0}>Create teacher first</option>
                ) : (
                  teachersList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))
                )}
              </select>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white"
              >
                Save Allocation
              </button>
            </div>
          </form>

          {/* Subject Teacher Allocations & Subjects Directories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Subject Teacher Allocations</h3>
                  <span className="text-xs font-mono text-slate-500">
                    {filteredAllocations.length} of {classesData.assignments.length} assigned
                  </span>
                </div>
                <div className="relative w-full sm:w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="search"
                    value={allocationSearch}
                    onChange={(e) => setAllocationSearch(e.target.value)}
                    placeholder="Search teacher, subject, class..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Class</th>
                      <th className="py-2.5 px-4">Subject</th>
                      <th className="py-2.5 px-4">Teacher</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredAllocations.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                          {classesData.assignments.length === 0
                            ? 'No subject teacher allocations yet.'
                            : 'No allocations match your search.'}
                        </td>
                      </tr>
                    ) : (
                      filteredAllocations.map((a) => {
                        const clsObj = classesData.classes.find((c) => c.id === a.classId);
                        const clsLabel = clsObj ? `${clsObj.name}-${clsObj.section}` : `Class #${a.classId}`;
                        return (
                          <tr key={a.id}>
                            <td className="py-2.5 px-4 text-xs font-semibold">{clsLabel}</td>
                            <td className="py-2.5 px-4 text-xs">{a.subjectName}</td>
                            <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                              {a.teacherName}
                            </td>
                            <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignClassId(a.classId);
                                  setAssignSubjectId(a.subjectId);
                                  setAssignTeacherId(a.teacherId);
                                  showToast('Loaded Into Form', `Update teacher for ${clsLabel} · ${a.subjectName} above.`, 'info');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  requestDeleteClassSubject(a.id, `${a.teacherName} (${clsLabel} · ${a.subjectName})`)
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Subjects Directory</h3>
                  <span className="text-xs font-mono text-slate-500">
                    {filteredSubjects.length} of {subjectsList.length} subjects
                  </span>
                </div>
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="search"
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                    placeholder="Search subject or code..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Subject</th>
                      <th className="py-2.5 px-4">Code</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-xs text-slate-500">
                          {subjectsList.length === 0
                            ? 'No subjects added yet.'
                            : 'No subjects match your search.'}
                        </td>
                      </tr>
                    ) : (
                      filteredSubjects.map((sub) => (
                        <tr key={sub.id}>
                          <td className="py-2.5 px-4 text-xs font-medium">{sub.name}</td>
                          <td className="py-2.5 px-4 text-xs font-mono text-slate-500">{sub.code}</td>
                          <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEditSubjectModal(sub)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteSubject(sub)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FACULTY & ACCOUNTS (RBAC) */}
      {section === 'users' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateUser}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              Create Teacher / School Portal Account
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full Name"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                value={newIdentifier}
                onChange={(e) => setNewIdentifier(e.target.value)}
                placeholder={
                  newRole === 'TEACHER'
                    ? 'TCH-021'
                    : newRole === 'PARENT'
                      ? 'PAR-101'
                      : 'STU-10A-021'
                }
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 chars"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
              <select
                value={newRole}
                onChange={(e) => {
                  setNewRole(e.target.value as 'TEACHER' | 'PARENT' | 'STUDENT');
                  setNewIdentifier('');
                }}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="TEACHER">Teacher (School ID)</option>
                <option value="PARENT">Parent (School ID)</option>
                <option value="STUDENT">Student (School ID)</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--sc-primary)] text-white text-sm font-semibold px-4 py-2"
              >
                <Plus className="w-4 h-4" /> Create
              </button>
            </div>
          </form>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
              {['ALL', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                    roleFilter === r
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-1 justify-end">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search faculty, parent, student name, ID, or class..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs"
                />
              </div>
              <span className="text-xs font-mono text-slate-500 whitespace-nowrap">
                Showing {Math.min(filteredUsers.length, 100)} of {filteredUsers.length}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Username / School ID</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Assigned Class</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Account Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                        No portal accounts match your search or role filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.slice(0, 100).map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4 font-medium">
                        <div>{u.fullName}</div>
                        {u.phone && (
                          <div className="text-xs font-mono text-slate-500">{u.phone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        {u.username || u.email || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">{u.role}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {u.role === 'TEACHER'
                          ? assignedClassByTeacherId.get(u.id) || 'Unassigned'
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                            <UserCheck className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                            <UserX className="w-3.5 h-3.5" /> Disabled
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        {u.role !== 'ADMIN' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditUserModal(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => resetUserPassword(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <KeyRound className="w-3.5 h-3.5" /> Reset Access
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleUserActive(u)}
                              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              {u.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" /> Protected Admin
                          </span>
                        )}
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITY & AUDIT LOGS SECTION */}
      {section === 'activity' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              placeholder="Filter activity by actor, action, or details..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--sc-primary)]" />
              <h2 className="text-sm font-semibold">School Activity &amp; Audit Logs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-slate-500">
                        No matching activity records found.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium">
                          {log.actorName} · {log.actorRole}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BRANDING SECTION */}
      {section === 'branding' && branding && (
        <form
          onSubmit={handleSaveBranding}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 max-w-3xl"
        >
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[var(--sc-primary)]" />
            <h2 className="text-base font-semibold">School Branding &amp; Theme Configuration</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                School Name
              </label>
              <input
                type="text"
                value={branding.schoolName}
                onChange={(e) =>
                  setBranding({ ...branding, schoolName: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Academic Year
              </label>
              <input
                type="text"
                value={branding.currentAcademicYear}
                onChange={(e) =>
                  setBranding({ ...branding, currentAcademicYear: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Tagline
              </label>
              <input
                type="text"
                value={branding.tagline}
                onChange={(e) =>
                  setBranding({ ...branding, tagline: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                School Email
              </label>
              <input
                type="email"
                value={branding.email}
                onChange={(e) =>
                  setBranding({ ...branding, email: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                School Phone
              </label>
              <input
                type="text"
                value={branding.phone}
                onChange={(e) =>
                  setBranding({ ...branding, phone: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Address
              </label>
              <input
                type="text"
                value={branding.address}
                onChange={(e) =>
                  setBranding({ ...branding, address: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Primary Theme Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding({ ...branding, primaryColor: e.target.value })
                  }
                  className="h-9 w-12 rounded border border-slate-300"
                />
                <span className="font-mono text-xs">{branding.primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Accent Theme Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.accentColor}
                  onChange={(e) =>
                    setBranding({ ...branding, accentColor: e.target.value })
                  }
                  className="h-9 w-12 rounded border border-slate-300"
                />
                <span className="font-mono text-xs">{branding.accentColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                School Merchant UPI ID (for PhonePe / GPay / Paytm)
              </label>
              <input
                type="text"
                value={branding.merchantUpiId || 'macrovision.fees@okaxis'}
                onChange={(e) =>
                  setBranding({ ...branding, merchantUpiId: e.target.value })
                }
                placeholder="school.fees@okaxis"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Merchant Payee Name
              </label>
              <input
                type="text"
                value={branding.merchantPayeeName || branding.schoolName}
                onChange={(e) =>
                  setBranding({ ...branding, merchantPayeeName: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                School Bank Account Summary (for NetBanking / Card / Receipt)
              </label>
              <input
                type="text"
                value={
                  branding.bankAccountSummary ||
                  'Axis Bank Burhanpur · A/C ••••4821 · IFSC UTIB0001482'
                }
                onChange={(e) =>
                  setBranding({ ...branding, bankAccountSummary: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-[var(--sc-primary)] text-white text-sm font-semibold"
          >
            Save School Branding &amp; UPI Settings
          </button>
        </form>
      )}

      {/* Shared Student Details Modal */}
      <StudentDetailsModal
        open={studentModalOpen}
        mode={studentModalMode}
        role="ADMIN"
        student={editingStudent}
        classes={classesData.classes}
        onClose={() => {
          setStudentModalOpen(false);
          setEditingStudent(null);
        }}
        onSave={handleSaveStudent}
      />

      {/* Edit Faculty / User Account Modal */}
      {editingUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <form
            onSubmit={handleSaveUserEdit}
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Edit Account Details
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                aria-label="Close"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    School ID / Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={editUserUsername}
                    onChange={(e) => setEditUserUsername(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Role
                  </label>
                  <select
                    value={editUserRole}
                    onChange={(e) =>
                      setEditUserRole(e.target.value as 'TEACHER' | 'PARENT' | 'STUDENT')
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="TEACHER">TEACHER</option>
                    <option value="PARENT">PARENT</option>
                    <option value="STUDENT">STUDENT</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editUserPhone}
                    onChange={(e) => setEditUserPhone(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Account Status
                  </label>
                  <select
                    value={editUserActive ? 'ACTIVE' : 'DISABLED'}
                    onChange={(e) => setEditUserActive(e.target.value === 'ACTIVE')}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  New Password (optional — leave blank to keep current)
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  placeholder="Min 8 chars if changing"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEditUser}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white disabled:opacity-50"
              >
                {savingEditUser ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Class Modal */}
      {editingClass && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <form
            onSubmit={handleSaveClassEdit}
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Edit Class &amp; Teacher Assignment
              </h3>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                aria-label="Close"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Class Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editClassName}
                    onChange={(e) => setEditClassName(e.target.value)}
                    placeholder="Class 9"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Section *
                  </label>
                  <input
                    type="text"
                    required
                    value={editClassSection}
                    onChange={(e) => setEditClassSection(e.target.value)}
                    placeholder="B"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Room Number
                </label>
                <input
                  type="text"
                  value={editClassRoom}
                  onChange={(e) => setEditClassRoom(e.target.value)}
                  placeholder="101"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Assigned Class Teacher
                </label>
                <select
                  value={editClassTeacherId}
                  onChange={(e) => setEditClassTeacherId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value={0}>Unassigned</option>
                  {teachersList.map((t) => {
                    const otherClass = assignedClassByTeacherId.get(t.id);
                    const takenElsewhere = Boolean(
                      otherClass && editingClass.classTeacherId !== t.id
                    );
                    return (
                      <option key={t.id} value={t.id} disabled={takenElsewhere}>
                        {t.fullName} ({t.username})
                        {takenElsewhere ? ` — Assigned to ${otherClass}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEditClass}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white disabled:opacity-50"
              >
                {savingEditClass ? 'Saving...' : 'Save Class'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Subject Modal */}
      {editingSubject && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <form
            onSubmit={handleSaveSubjectEdit}
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Edit Subject
              </h3>
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                aria-label="Close"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  value={editSubName}
                  onChange={(e) => setEditSubName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Subject Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={editSubCode}
                    onChange={(e) => setEditSubCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editSubDept}
                    onChange={(e) => setEditSubDept(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEditSub}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white disabled:opacity-50"
              >
                {savingEditSub ? 'Saving...' : 'Save Subject'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmState?.open)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        confirmLabel={confirmState?.confirmLabel || 'Confirm'}
        destructive
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
};
