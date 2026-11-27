import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  academicYears,
  assignments,
  attendance,
  auditLogs,
  classes,
  classSubjects,
  exams,
  galleryItems,
  homework,
  marks,
  notes,
  notices,
  notifications,
  parentStudentLinks,
  schoolEvents,
  studentActivities,
  students,
  subjects,
  teacherRemarks,
  users,
} from '../db/schema.ts';
import {
  AuthRequest,
  canClassTeacherManageStudent,
  getAssignedHomeroomClassIds,
  isTeacherClassTeacherOfClass,
  requireAuth,
  requireRole,
} from '../middleware/auth.ts';
import {
  ALLOWED_ACTIVITY_IMAGE_EXTS,
  ALLOWED_ACTIVITY_VIDEO_EXTS,
  ALLOWED_UPLOAD_EXTENSIONS,
  computeGrade,
  hashPassword,
  MAX_ACTIVITY_MEDIA_BYTES,
  MAX_UPLOAD_BYTES,
  parseMarksCsv,
  resolveSafeUploadPath,
  sanitizeStoredFilename,
  signMediaAccessToken,
} from '../utils/security.ts';

const router = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const ACTIVITY_UPLOADS_DIR = path.resolve(UPLOADS_DIR, 'activities');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(ACTIVITY_UPLOADS_DIR)) {
  fs.mkdirSync(ACTIVITY_UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, sanitizeStoredFilename(file.originalname)),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
      return cb(new Error(`Unsupported file type (${ext}). Allowed: PDF, DOC, DOCX, PPT, PPTX, TXT, PNG, JPG, CSV.`));
    }
    cb(null, true);
  },
});

const activityUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ACTIVITY_UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, sanitizeStoredFilename(file.originalname)),
  }),
  limits: { fileSize: MAX_ACTIVITY_MEDIA_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = ALLOWED_ACTIVITY_IMAGE_EXTS.has(ext);
    const isVideo = ALLOWED_ACTIVITY_VIDEO_EXTS.has(ext);
    if (!isImage && !isVideo) {
      return cb(
        new Error(
          `Unsupported media format (${ext || 'unknown'}). Allowed photos: PNG, JPG, JPEG, WEBP, GIF, HEIC. Allowed videos: MP4, MOV, WEBM, MKV, AVI, M4V.`
        )
      );
    }
    cb(null, true);
  },
});

async function logAudit(
  actor: NonNullable<AuthRequest['authUser']>,
  action: string,
  entityType: string,
  entityId: string | number,
  details: string
) {
  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    action,
    entityType,
    entityId: String(entityId),
    details,
  });
}

async function notifyClassParentsAndStudents(
  classId: number,
  title: string,
  message: string,
  type: string,
  linkTab: string
) {
  const classStudents = await db
    .select({ id: students.id, userId: students.userId })
    .from(students)
    .where(eq(students.classId, classId));

  if (classStudents.length === 0) return;

  const studentIds = classStudents.map((s) => s.id);
  const parentLinks = await db
    .select({ parentId: parentStudentLinks.parentId })
    .from(parentStudentLinks)
    .where(inArray(parentStudentLinks.studentId, studentIds));

  const targetUserIds = new Set<number>();
  for (const s of classStudents) {
    if (s.userId) targetUserIds.add(s.userId);
  }
  for (const p of parentLinks) {
    targetUserIds.add(p.parentId);
  }

  if (targetUserIds.size === 0) return;
  await db.insert(notifications).values(
    Array.from(targetUserIds).map((uid) => ({
      userId: uid,
      title,
      message,
      type,
      linkTab,
    }))
  );
}

router.use(requireAuth, requireRole('TEACHER', 'ADMIN'));

// Teacher Dashboard Overview (strictly scoped to Admin-assigned Class Teacher class)
router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const classIds =
      user.role === 'ADMIN'
        ? (await db.select({ id: classes.id }).from(classes)).map((c) => c.id)
        : await getAssignedHomeroomClassIds(user.id);

    const myClassesRaw =
      classIds.length > 0
        ? await db
            .select({
              id: classes.id,
              name: classes.name,
              section: classes.section,
              roomNumber: classes.roomNumber,
              classTeacherId: classes.classTeacherId,
            })
            .from(classes)
            .where(inArray(classes.id, classIds))
        : [];

    const mySubjects =
      user.role === 'ADMIN'
        ? await db
            .select({
              classId: classSubjects.classId,
              className: classes.name,
              section: classes.section,
              subjectId: subjects.id,
              subjectName: subjects.name,
            })
            .from(classSubjects)
            .innerJoin(classes, eq(classSubjects.classId, classes.id))
            .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
        : classIds.length > 0
          ? await db
              .select({
                classId: classSubjects.classId,
                className: classes.name,
                section: classes.section,
                subjectId: subjects.id,
                subjectName: subjects.name,
              })
              .from(classSubjects)
              .innerJoin(classes, eq(classSubjects.classId, classes.id))
              .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
              .where(inArray(classSubjects.classId, classIds))
          : [];

    const classStudents =
      classIds.length > 0
        ? await db
            .select({ id: students.id, classId: students.classId })
            .from(students)
            .where(inArray(students.classId, classIds))
        : [];

    const studentCountByClass = new Map<number, number>();
    for (const s of classStudents) {
      studentCountByClass.set(s.classId, (studentCountByClass.get(s.classId) || 0) + 1);
    }

    const myClasses = myClassesRaw.map((c) => ({
      id: c.id,
      name: c.name,
      section: c.section,
      roomNumber: c.roomNumber,
      isClassTeacher: c.classTeacherId === user.id,
      studentCount: studentCountByClass.get(c.id) || 0,
    }));

    const activeAssignments =
      classIds.length > 0
        ? await db
            .select({ id: assignments.id })
            .from(assignments)
            .where(and(inArray(assignments.classId, classIds), eq(assignments.status, 'OPEN')))
        : [];

    const todayStr = new Date().toISOString().slice(0, 10);
    const upcomingExams = await db
      .select({ id: exams.id, name: exams.name, examDate: exams.examDate, classId: exams.classId })
      .from(exams)
      .where(sql`${exams.examDate} >= ${todayStr}`)
      .orderBy(exams.examDate);

    const activeNotices = await db.select({ id: notices.id }).from(notices);

    const existingMarksCount =
      classIds.length > 0
        ? await db
            .select({ examId: marks.examId })
            .from(marks)
            .where(inArray(marks.classId, classIds))
        : [];
    const gradedExamIds = new Set(existingMarksCount.map((m) => m.examId));
    const relevantExams = upcomingExams.filter(
      (e) => !e.classId || classIds.includes(e.classId)
    );
    const pendingMarks =
      classStudents.length === 0
        ? 0
        : relevantExams.filter((e) => !gradedExamIds.has(e.id)).length;

    // Average performance per class
    const classPerformance =
      classIds.length > 0
        ? await db
            .select({
              classId: marks.classId,
              className: classes.name,
              section: classes.section,
              avgPct: sql<number>`ROUND(AVG(${marks.obtainedMarks}::numeric / NULLIF(${marks.maxMarks}, 0) * 100), 1)`,
            })
            .from(marks)
            .innerJoin(classes, eq(marks.classId, classes.id))
            .where(inArray(marks.classId, classIds))
            .groupBy(marks.classId, classes.name, classes.section)
        : [];

    // StudentDashboard-matching academic summaries for the assigned class
    const recentMarksRaw =
      classIds.length > 0
        ? await db
            .select({
              id: marks.id,
              studentId: marks.studentId,
              studentCode: students.studentCode,
              studentName: students.fullName,
              rollNumber: students.rollNumber,
              subjectId: subjects.id,
              subjectName: subjects.name,
              examId: exams.id,
              examName: exams.name,
              examDate: exams.examDate,
              obtainedMarks: marks.obtainedMarks,
              maxMarks: marks.maxMarks,
              grade: marks.grade,
              teacherRemark: marks.teacherRemark,
            })
            .from(marks)
            .innerJoin(students, eq(marks.studentId, students.id))
            .innerJoin(subjects, eq(marks.subjectId, subjects.id))
            .innerJoin(exams, eq(marks.examId, exams.id))
            .where(inArray(marks.classId, classIds))
            .orderBy(desc(marks.updatedAt), students.rollNumber)
            .limit(20)
        : [];

    const recentMarks = recentMarksRaw.map((m) => ({
      ...m,
      percentage: m.maxMarks > 0 ? Math.round((m.obtainedMarks / m.maxMarks) * 1000) / 10 : 0,
    }));

    const classHomeworkRows =
      classIds.length > 0
        ? await db
            .select({
              id: homework.id,
              title: homework.title,
              description: homework.description,
              dueDate: homework.dueDate,
              priority: homework.priority,
              classId: homework.classId,
              className: classes.name,
              section: classes.section,
              subjectId: subjects.id,
              subjectName: subjects.name,
              teacherName: users.fullName,
              attachmentName: homework.attachmentName,
              attachmentUrl: homework.attachmentUrl,
            })
            .from(homework)
            .innerJoin(classes, eq(homework.classId, classes.id))
            .innerJoin(subjects, eq(homework.subjectId, subjects.id))
            .innerJoin(users, eq(homework.teacherId, users.id))
            .where(inArray(homework.classId, classIds))
            .orderBy(homework.dueDate)
            .limit(20)
        : [];

    const upcomingHwFiltered = classHomeworkRows.filter((h) => h.dueDate >= todayStr);
    const upcomingHomework =
      upcomingHwFiltered.length > 0 ? upcomingHwFiltered : classHomeworkRows;

    const classAttendanceRows =
      classIds.length > 0
        ? await db
            .select({
              id: attendance.id,
              studentId: attendance.studentId,
              studentCode: students.studentCode,
              studentName: students.fullName,
              rollNumber: students.rollNumber,
              date: attendance.date,
              status: attendance.status,
              note: attendance.note,
            })
            .from(attendance)
            .innerJoin(students, eq(attendance.studentId, students.id))
            .where(inArray(attendance.classId, classIds))
            .orderBy(desc(attendance.date), students.rollNumber)
            .limit(25)
        : [];

    const allClassAtt =
      classIds.length > 0
        ? await db
            .select({ status: attendance.status })
            .from(attendance)
            .where(inArray(attendance.classId, classIds))
        : [];
    const schoolAttDays = allClassAtt.filter((a) => a.status !== 'HOLIDAY');
    const attPresent = schoolAttDays.filter((a) => a.status === 'PRESENT').length;
    const attLate = schoolAttDays.filter((a) => a.status === 'LATE').length;
    const attAbsent = schoolAttDays.filter((a) => a.status === 'ABSENT').length;
    const attExcused = schoolAttDays.filter((a) => a.status === 'EXCUSED').length;
    const attendanceSummary = {
      totalSchoolDays: schoolAttDays.length,
      present: attPresent,
      late: attLate,
      absent: attAbsent,
      excused: attExcused,
      percentage:
        schoolAttDays.length > 0
          ? Math.round(((attPresent + attLate) / schoolAttDays.length) * 1000) / 10
          : 100,
    };

    const recentActivity = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(8);

    const allExams = await db.select().from(exams).orderBy(exams.examDate);
    const allSubjects = await db.select().from(subjects).orderBy(subjects.name);

    return res.json({
      stats: {
        totalStudents: classStudents.length,
        activeAssignments: activeAssignments.length,
        upcomingExams: relevantExams.length,
        activeNotices: activeNotices.length,
        pendingMarks,
      },
      myClasses,
      mySubjects,
      classPerformance: classPerformance.map((p) => ({
        ...p,
        avgPct: Number(p.avgPct),
      })),
      recentMarks,
      upcomingHomework,
      recentAttendance: classAttendanceRows,
      attendanceSummary,
      recentActivity,
      exams: allExams,
      subjects: allSubjects,
    });
  } catch (err) {
    console.error('Teacher dashboard error:', err);
    return res.status(500).json({ error: 'Failed to load teacher dashboard.' });
  }
});

// Teacher's authorized students list (with full student profile details)
const optionalDetailText = (maxLen = 200) =>
  z.string().max(maxLen).optional().nullable().or(z.literal(''));

const cleanOpt = (val?: string | null) => {
  const trimmed = (val ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

router.get('/students', async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const classIds =
      user.role === 'ADMIN'
        ? (await db.select({ id: classes.id }).from(classes)).map((c) => c.id)
        : await getAssignedHomeroomClassIds(user.id);

    if (classIds.length === 0) return res.json([]);

    const requestedClassId = req.query.classId ? Number(req.query.classId) : null;
    if (requestedClassId && !classIds.includes(requestedClassId)) {
      return res.status(403).json({ error: 'You are not authorized to view students in that class.' });
    }
    const filterIds = requestedClassId ? [requestedClassId] : classIds;

    const rows = await db
      .select({
        id: students.id,
        userId: students.userId,
        studentCode: students.studentCode,
        fullName: students.fullName,
        rollNumber: students.rollNumber,
        classId: students.classId,
        className: classes.name,
        section: classes.section,
        roomNumber: classes.roomNumber,
        admissionDate: students.admissionDate,
        gender: students.gender,
        dateOfBirth: students.dateOfBirth,
        bloodGroup: students.bloodGroup,
        fatherName: students.fatherName,
        motherName: students.motherName,
        guardianPhone: students.guardianPhone,
        guardianEmail: students.guardianEmail,
        address: students.address,
        emergencyContact: students.emergencyContact,
        previousSchool: students.previousSchool,
        medicalNotes: students.medicalNotes,
        houseName: students.houseName,
        avatarUrl: students.avatarUrl,
        isActive: students.isActive,
      })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(inArray(students.classId, filterIds))
      .orderBy(classes.name, classes.section, students.rollNumber);

    return res.json(
      rows.map(({ userId, ...rest }) => ({
        ...rest,
        hasPortalAccount: Boolean(userId),
      }))
    );
  } catch (err) {
    console.error('Failed to fetch students:', err);
    return res.status(500).json({ error: 'Failed to load students.' });
  }
});

// Add Student (Strictly Admin-assigned Class Teacher or Admin)
const addStudentSchema = z.object({
  fullName: z.string().min(2).max(120),
  studentCode: z.string().min(3).max(40),
  classId: z.number().int().positive(),
  rollNumber: z.number().int().positive(),
  admissionDate: z.string().max(30).optional(),
  gender: optionalDetailText(40),
  dateOfBirth: optionalDetailText(30),
  bloodGroup: optionalDetailText(20),
  fatherName: optionalDetailText(120),
  motherName: optionalDetailText(120),
  guardianPhone: optionalDetailText(30),
  guardianEmail: optionalDetailText(120),
  address: optionalDetailText(300),
  emergencyContact: optionalDetailText(120),
  previousSchool: optionalDetailText(160),
  medicalNotes: optionalDetailText(400),
  houseName: optionalDetailText(60),
  password: z.string().min(8).max(128).optional().or(z.literal('')),
});

router.post('/students', async (req: AuthRequest, res) => {
  const parsed = addStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid student data.' });
  }
  const cleanCode = parsed.data.studentCode.trim().toUpperCase();
  if (cleanCode.includes('@')) {
    return res.status(400).json({ error: 'Student ID must be a School ID code (e.g. STU-10A-001), not an email address.' });
  }
  const user = req.authUser!;
  if (user.role === 'TEACHER') {
    const allowed = await isTeacherClassTeacherOfClass(user.id, parsed.data.classId);
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied. You can only add students to the class assigned to you by the administrator.' });
    }
  }
  try {
    const [currentYear] = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.isCurrent, true))
      .limit(1);

    let linkedUserId: number | null = null;
    if (parsed.data.password && parsed.data.password.length >= 8) {
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`UPPER(${users.username}) = ${cleanCode}`)
        .limit(1);

      if (existingUser) {
        return res.status(409).json({ error: `School ID "${cleanCode}" is already assigned to a user account.` });
      }

      const [studentUser] = await db
        .insert(users)
        .values({
          username: cleanCode,
          email: null,
          passwordHash: hashPassword(parsed.data.password),
          fullName: parsed.data.fullName.trim(),
          role: 'STUDENT',
          isActive: true,
        })
        .returning({ id: users.id });
      linkedUserId = studentUser.id;
    }

    const [created] = await db
      .insert(students)
      .values({
        userId: linkedUserId,
        fullName: parsed.data.fullName.trim(),
        studentCode: cleanCode,
        classId: parsed.data.classId,
        rollNumber: parsed.data.rollNumber,
        academicYearId: currentYear?.id || 1,
        admissionDate: cleanOpt(parsed.data.admissionDate) || new Date().toISOString().slice(0, 10),
        gender: cleanOpt(parsed.data.gender) || 'Not specified',
        dateOfBirth: cleanOpt(parsed.data.dateOfBirth),
        bloodGroup: cleanOpt(parsed.data.bloodGroup),
        fatherName: cleanOpt(parsed.data.fatherName),
        motherName: cleanOpt(parsed.data.motherName),
        guardianPhone: cleanOpt(parsed.data.guardianPhone),
        guardianEmail: cleanOpt(parsed.data.guardianEmail),
        address: cleanOpt(parsed.data.address),
        emergencyContact: cleanOpt(parsed.data.emergencyContact),
        previousSchool: cleanOpt(parsed.data.previousSchool),
        medicalNotes: cleanOpt(parsed.data.medicalNotes),
        houseName: cleanOpt(parsed.data.houseName),
      })
      .returning();

    await logAudit(
      user,
      'ADD_STUDENT',
      'students',
      created.id,
      `${user.fullName} added student ${created.fullName} (${created.studentCode})${linkedUserId ? ' with portal login account' : ''}.`
    );
    return res.status(201).json({ ...created, hasPortalAccount: Boolean(linkedUserId) });
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Student ID already exists.' });
    }
    console.error('Add student error:', err);
    return res.status(500).json({ error: 'Failed to add student.' });
  }
});

// Update Detailed Student Info & Portal Credentials (Strict RBAC: ONLY the Admin-assigned Class Teacher)
const updateTeacherStudentSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  rollNumber: z.number().int().positive().optional(),
  admissionDate: z.string().max(30).optional(),
  gender: optionalDetailText(40),
  dateOfBirth: optionalDetailText(30),
  bloodGroup: optionalDetailText(20),
  fatherName: optionalDetailText(120),
  motherName: optionalDetailText(120),
  guardianPhone: optionalDetailText(30),
  guardianEmail: optionalDetailText(120),
  address: optionalDetailText(300),
  emergencyContact: optionalDetailText(120),
  previousSchool: optionalDetailText(160),
  medicalNotes: optionalDetailText(400),
  houseName: optionalDetailText(60),
  portalPassword: z.string().min(8).max(128).optional().or(z.literal('')),
});

router.patch('/students/:id', async (req: AuthRequest, res) => {
  const studentId = Number(req.params.id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: 'Invalid student ID.' });
  }
  const parsed = updateTeacherStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid student details.' });
  }

  const user = req.authUser!;
  try {
    const allowed = await canClassTeacherManageStudent(user, studentId);
    if (!allowed) {
      return res.status(403).json({
        error: 'Access denied. Class teachers can only view or edit students in the class assigned to them by the administrator.',
      });
    }

    const [existing] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    let linkedUserId = existing.userId;
    if (parsed.data.portalPassword && parsed.data.portalPassword.length >= 8) {
      if (linkedUserId) {
        await db
          .update(users)
          .set({ passwordHash: hashPassword(parsed.data.portalPassword) })
          .where(eq(users.id, linkedUserId));
      } else {
        const [dup] = await db
          .select({ id: users.id })
          .from(users)
          .where(sql`UPPER(${users.username}) = ${existing.studentCode.toUpperCase()}`)
          .limit(1);
        if (dup) {
          return res.status(409).json({ error: `School ID "${existing.studentCode}" already has a portal account.` });
        }
        const [newStuUser] = await db
          .insert(users)
          .values({
            username: existing.studentCode.toUpperCase(),
            email: null,
            passwordHash: hashPassword(parsed.data.portalPassword),
            fullName: parsed.data.fullName?.trim() || existing.fullName,
            role: 'STUDENT',
            isActive: true,
          })
          .returning({ id: users.id });
        linkedUserId = newStuUser.id;
      }
    }

    const d = parsed.data;
    const [updated] = await db
      .update(students)
      .set({
        userId: linkedUserId,
        ...(d.fullName !== undefined ? { fullName: d.fullName.trim() } : {}),
        ...(d.rollNumber !== undefined ? { rollNumber: d.rollNumber } : {}),
        ...(d.admissionDate !== undefined && d.admissionDate.trim() ? { admissionDate: d.admissionDate.trim() } : {}),
        ...(d.gender !== undefined ? { gender: cleanOpt(d.gender) || 'Not specified' } : {}),
        ...(d.dateOfBirth !== undefined ? { dateOfBirth: cleanOpt(d.dateOfBirth) } : {}),
        ...(d.bloodGroup !== undefined ? { bloodGroup: cleanOpt(d.bloodGroup) } : {}),
        ...(d.fatherName !== undefined ? { fatherName: cleanOpt(d.fatherName) } : {}),
        ...(d.motherName !== undefined ? { motherName: cleanOpt(d.motherName) } : {}),
        ...(d.guardianPhone !== undefined ? { guardianPhone: cleanOpt(d.guardianPhone) } : {}),
        ...(d.guardianEmail !== undefined ? { guardianEmail: cleanOpt(d.guardianEmail) } : {}),
        ...(d.address !== undefined ? { address: cleanOpt(d.address) } : {}),
        ...(d.emergencyContact !== undefined ? { emergencyContact: cleanOpt(d.emergencyContact) } : {}),
        ...(d.previousSchool !== undefined ? { previousSchool: cleanOpt(d.previousSchool) } : {}),
        ...(d.medicalNotes !== undefined ? { medicalNotes: cleanOpt(d.medicalNotes) } : {}),
        ...(d.houseName !== undefined ? { houseName: cleanOpt(d.houseName) } : {}),
      })
      .where(eq(students.id, studentId))
      .returning();

    await logAudit(
      user,
      'UPDATE_STUDENT_DETAILS',
      'students',
      updated.id,
      `${user.fullName} updated detailed student record for ${updated.fullName} (${updated.studentCode}).`
    );

    return res.json({ ...updated, hasPortalAccount: Boolean(linkedUserId) });
  } catch (err) {
    console.error('Teacher update student error:', err);
    return res.status(500).json({ error: 'Failed to update student details.' });
  }
});

// Marks List for Class + Subject + Exam
router.get('/marks', async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const classIds =
      user.role === 'ADMIN'
        ? (await db.select({ id: classes.id }).from(classes)).map((c) => c.id)
        : await getAssignedHomeroomClassIds(user.id);
    if (classIds.length === 0) return res.json([]);

    const classId = req.query.classId ? Number(req.query.classId) : null;
    const examId = req.query.examId ? Number(req.query.examId) : null;
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;

    if (classId && !classIds.includes(classId)) {
      return res.status(403).json({ error: 'Not authorized for this class.' });
    }

    const conditions = [inArray(marks.classId, classId ? [classId] : classIds)];
    if (examId) conditions.push(eq(marks.examId, examId));
    if (subjectId) conditions.push(eq(marks.subjectId, subjectId));

    const rows = await db
      .select({
        id: marks.id,
        studentId: marks.studentId,
        studentCode: students.studentCode,
        studentName: students.fullName,
        rollNumber: students.rollNumber,
        classId: marks.classId,
        className: classes.name,
        section: classes.section,
        subjectId: marks.subjectId,
        subjectName: subjects.name,
        examId: marks.examId,
        examName: exams.name,
        obtainedMarks: marks.obtainedMarks,
        maxMarks: marks.maxMarks,
        grade: marks.grade,
        teacherRemark: marks.teacherRemark,
        updatedAt: marks.updatedAt,
      })
      .from(marks)
      .innerJoin(students, eq(marks.studentId, students.id))
      .innerJoin(classes, eq(marks.classId, classes.id))
      .innerJoin(subjects, eq(marks.subjectId, subjects.id))
      .innerJoin(exams, eq(marks.examId, exams.id))
      .where(and(...conditions))
      .orderBy(students.rollNumber);

    return res.json(rows);
  } catch (err) {
    console.error('Error loading marks:', err);
    return res.status(500).json({ error: 'Failed to fetch marks.' });
  }
});

// Single Mark Save / Upsert
const markSaveSchema = z
  .object({
    studentId: z.number().int().positive(),
    subjectId: z.number().int().positive(),
    examId: z.number().int().positive(),
    obtainedMarks: z.number().int().min(0, 'Marks cannot be negative.'),
    maxMarks: z.number().int().positive('Maximum marks must be positive.'),
    teacherRemark: z.string().max(400).optional(),
  })
  .refine((d) => d.obtainedMarks <= d.maxMarks, {
    message: 'Marks cannot exceed maximum marks.',
  });

router.post('/marks', async (req: AuthRequest, res) => {
  const parsed = markSaveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid marks payload.' });
  }
  const user = req.authUser!;
  try {
    const [stu] = await db
      .select()
      .from(students)
      .where(eq(students.id, parsed.data.studentId))
      .limit(1);

    if (!stu) {
      return res.status(404).json({ error: 'Student ID not found.' });
    }

    if (user.role === 'TEACHER') {
      const allowed = await isTeacherClassTeacherOfClass(user.id, stu.classId);
      if (!allowed) {
        return res.status(403).json({ error: 'You are not authorized to enter marks for this student’s class.' });
      }
    }

    const grade = computeGrade(parsed.data.obtainedMarks, parsed.data.maxMarks);
    const [saved] = await db
      .insert(marks)
      .values({
        studentId: stu.id,
        subjectId: parsed.data.subjectId,
        examId: parsed.data.examId,
        classId: stu.classId,
        obtainedMarks: parsed.data.obtainedMarks,
        maxMarks: parsed.data.maxMarks,
        grade,
        teacherRemark: parsed.data.teacherRemark?.trim() || null,
        uploadedById: user.id,
      })
      .onConflictDoUpdate({
        target: [marks.studentId, marks.subjectId, marks.examId],
        set: {
          obtainedMarks: parsed.data.obtainedMarks,
          maxMarks: parsed.data.maxMarks,
          grade,
          teacherRemark: parsed.data.teacherRemark?.trim() || null,
          uploadedById: user.id,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Notify parent(s) and student
    const [sub] = await db
      .select({ name: subjects.name })
      .from(subjects)
      .where(eq(subjects.id, parsed.data.subjectId))
      .limit(1);

    const parentLinks = await db
      .select({ parentId: parentStudentLinks.parentId })
      .from(parentStudentLinks)
      .where(eq(parentStudentLinks.studentId, stu.id));

    const notifTargets = new Set<number>();
    if (stu.userId) notifTargets.add(stu.userId);
    for (const p of parentLinks) notifTargets.add(p.parentId);

    if (notifTargets.size > 0) {
      await db.insert(notifications).values(
        Array.from(notifTargets).map((uid) => ({
          userId: uid,
          title: 'New Marks Uploaded',
          message: `${stu.fullName} scored ${parsed.data.obtainedMarks}/${parsed.data.maxMarks} (${grade}) in ${sub?.name || 'Subject'}.`,
          type: 'MARKS',
          linkTab: 'academics',
        }))
      );
    }

    await logAudit(
      user,
      'UPSERT_MARKS',
      'marks',
      saved.id,
      `${user.fullName} saved ${sub?.name || 'Subject'} marks (${parsed.data.obtainedMarks}/${parsed.data.maxMarks}) for ${stu.fullName}.`
    );

    return res.json(saved);
  } catch (err) {
    console.error('Error saving marks:', err);
    return res.status(500).json({ error: 'Failed to save marks.' });
  }
});

router.delete('/marks/:id', async (req: AuthRequest, res) => {
  const markId = Number(req.params.id);
  if (!Number.isInteger(markId) || markId <= 0) {
    return res.status(400).json({ error: 'Invalid mark ID.' });
  }
  const user = req.authUser!;
  try {
    const [existing] = await db
      .select()
      .from(marks)
      .where(eq(marks.id, markId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Mark record not found.' });
    }
    if (user.role === 'TEACHER') {
      const allowed = await isTeacherClassTeacherOfClass(user.id, existing.classId);
      if (!allowed) {
        return res.status(403).json({ error: 'Not authorized to delete marks for this class.' });
      }
    }

    await db.delete(marks).where(eq(marks.id, markId));
    await logAudit(
      user,
      'DELETE_MARKS',
      'marks',
      markId,
      `${user.fullName} deleted mark record #${markId}.`
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete mark failed:', err);
    return res.status(500).json({ error: 'Failed to delete mark.' });
  }
});

// CSV Marks Bulk Upload with Validation (Student ID not found, Marks > Max Marks, Duplicate result)
const csvUploadSchema = z.object({
  csvText: z.string().min(5, 'CSV content cannot be empty.'),
  overwriteExisting: z.boolean().optional(),
});

router.post('/marks/csv', async (req: AuthRequest, res) => {
  const parsed = csvUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid CSV payload.' });
  }
  const user = req.authUser!;
  const csvResult = parseMarksCsv(parsed.data.csvText);
  const errors = [...csvResult.errors];

  if (csvResult.rows.length === 0 && errors.length > 0) {
    return res.status(400).json({ error: 'CSV validation failed.', validationErrors: errors, importedCount: 0 });
  }

  try {
    const allStudents = await db.select().from(students);
    const allSubjects = await db.select().from(subjects);
    const allExams = await db.select().from(exams);
    const existingMarks = await db
      .select({
        studentId: marks.studentId,
        subjectId: marks.subjectId,
        examId: marks.examId,
      })
      .from(marks);

    const studentMap = new Map(allStudents.map((s) => [s.studentCode.toUpperCase(), s]));
    const subjectMap = new Map(allSubjects.map((s) => [s.name.toLowerCase(), s]));
    const examMap = new Map(allExams.map((e) => [e.name.toLowerCase(), e]));
    const existingKeys = new Set(
      existingMarks.map((m) => `${m.studentId}:${m.subjectId}:${m.examId}`)
    );
    const seenInBatch = new Set<string>();

    const teacherClassIds =
      user.role === 'ADMIN' ? null : new Set(await getAssignedHomeroomClassIds(user.id));

    const validInserts: Array<{
      studentId: number;
      subjectId: number;
      examId: number;
      classId: number;
      obtainedMarks: number;
      maxMarks: number;
      grade: string;
      teacherRemark: string | null;
      uploadedById: number;
    }> = [];

    for (const row of csvResult.rows) {
      const stu = studentMap.get(row.studentCode.toUpperCase());
      if (!stu) {
        errors.push(`Row ${row.rowNumber}: Student ID not found (${row.studentCode}).`);
        continue;
      }
      if (teacherClassIds && !teacherClassIds.has(stu.classId)) {
        errors.push(`Row ${row.rowNumber}: You are not authorized to upload marks for ${row.studentCode}.`);
        continue;
      }

      const sub = subjectMap.get(row.subjectName.toLowerCase());
      if (!sub) {
        errors.push(`Row ${row.rowNumber}: Subject not found (${row.subjectName}).`);
        continue;
      }

      const exam = examMap.get(row.examName.toLowerCase());
      if (!exam) {
        errors.push(`Row ${row.rowNumber}: Exam not found (${row.examName}).`);
        continue;
      }

      const compositeKey = `${stu.id}:${sub.id}:${exam.id}`;
      if (seenInBatch.has(compositeKey)) {
        errors.push(`Row ${row.rowNumber}: Duplicate result detected in CSV (${row.studentCode} · ${sub.name} · ${exam.name}).`);
        continue;
      }
      if (existingKeys.has(compositeKey) && !parsed.data.overwriteExisting) {
        errors.push(`Row ${row.rowNumber}: Duplicate result detected (${row.studentCode} already has marks for ${sub.name} in ${exam.name}).`);
        continue;
      }

      seenInBatch.add(compositeKey);
      validInserts.push({
        studentId: stu.id,
        subjectId: sub.id,
        examId: exam.id,
        classId: stu.classId,
        obtainedMarks: row.obtainedMarks,
        maxMarks: row.maxMarks,
        grade: computeGrade(row.obtainedMarks, row.maxMarks),
        teacherRemark: row.remark || null,
        uploadedById: user.id,
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation errors found in uploaded CSV. Please review and fix before saving.',
        validationErrors: errors,
        importedCount: 0,
      });
    }

    for (const item of validInserts) {
      await db
        .insert(marks)
        .values(item)
        .onConflictDoUpdate({
          target: [marks.studentId, marks.subjectId, marks.examId],
          set: {
            obtainedMarks: item.obtainedMarks,
            maxMarks: item.maxMarks,
            grade: item.grade,
            teacherRemark: item.teacherRemark,
            uploadedById: user.id,
            updatedAt: new Date(),
          },
        });
    }

    await logAudit(
      user,
      'CSV_IMPORT_MARKS',
      'marks',
      'bulk',
      `${user.fullName} imported ${validInserts.length} mark records via CSV.`
    );

    return res.json({
      success: true,
      importedCount: validInserts.length,
      validationErrors: [],
    });
  } catch (err) {
    console.error('CSV marks upload error:', err);
    return res.status(500).json({ error: 'Failed to process CSV marks upload.' });
  }
});

// Attendance Register GET + Bulk Save
router.get('/attendance', async (req: AuthRequest, res) => {
  const classId = Number(req.query.classId);
  const date = String(req.query.date || '');
  if (!Number.isInteger(classId) || classId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Valid classId and date (YYYY-MM-DD) are required.' });
  }

  const user = req.authUser!;
  if (user.role === 'TEACHER') {
    const allowed = await isTeacherClassTeacherOfClass(user.id, classId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to view attendance for this class.' });
    }
  }

  try {
    const classStudents = await db
      .select({
        studentId: students.id,
        studentCode: students.studentCode,
        fullName: students.fullName,
        rollNumber: students.rollNumber,
      })
      .from(students)
      .where(eq(students.classId, classId))
      .orderBy(students.rollNumber);

    const existing = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.classId, classId), eq(attendance.date, date)));

    const existingMap = new Map(existing.map((e) => [e.studentId, e]));
    const rows = classStudents.map((s) => ({
      ...s,
      status: existingMap.get(s.studentId)?.status || 'PRESENT',
      note: existingMap.get(s.studentId)?.note || '',
      recorded: existingMap.has(s.studentId),
    }));

    return res.json(rows);
  } catch (err) {
    console.error('Attendance load failed:', err);
    return res.status(500).json({ error: 'Failed to load attendance register.' });
  }
});

const attendanceBulkSchema = z.object({
  classId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.'),
  records: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'HOLIDAY']),
        note: z.string().max(200).optional(),
      })
    )
    .min(1),
});

router.post('/attendance', async (req: AuthRequest, res) => {
  const parsed = attendanceBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid attendance payload.' });
  }
  const user = req.authUser!;
  if (user.role === 'TEACHER') {
    const allowed = await isTeacherClassTeacherOfClass(user.id, parsed.data.classId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to record attendance for this class.' });
    }
  }

  try {
    for (const rec of parsed.data.records) {
      await db
        .insert(attendance)
        .values({
          studentId: rec.studentId,
          classId: parsed.data.classId,
          date: parsed.data.date,
          status: rec.status,
          note: rec.note?.trim() || null,
          recordedById: user.id,
        })
        .onConflictDoUpdate({
          target: [attendance.studentId, attendance.date],
          set: {
            status: rec.status,
            note: rec.note?.trim() || null,
            recordedById: user.id,
          },
        });
    }

    // Notify parents of absent/late students
    const alertStudents = parsed.data.records.filter(
      (r) => r.status === 'ABSENT' || r.status === 'LATE'
    );
    if (alertStudents.length > 0) {
      const alertIds = alertStudents.map((r) => r.studentId);
      const links = await db
        .select({
          parentId: parentStudentLinks.parentId,
          studentId: parentStudentLinks.studentId,
        })
        .from(parentStudentLinks)
        .where(inArray(parentStudentLinks.studentId, alertIds));

      const statusByStudent = new Map(alertStudents.map((r) => [r.studentId, r.status]));
      if (links.length > 0) {
        await db.insert(notifications).values(
          links.map((l) => ({
            userId: l.parentId,
            title: 'Attendance Updated',
            message: `Attendance marked as ${statusByStudent.get(l.studentId)} on ${parsed.data.date}.`,
            type: 'ATTENDANCE',
            linkTab: 'attendance',
          }))
        );
      }
    }

    await logAudit(
      user,
      'RECORD_ATTENDANCE',
      'attendance',
      parsed.data.classId,
      `${user.fullName} saved attendance for Class #${parsed.data.classId} on ${parsed.data.date} (${parsed.data.records.length} students).`
    );

    return res.json({ success: true, count: parsed.data.records.length });
  } catch (err) {
    console.error('Attendance save error:', err);
    return res.status(500).json({ error: 'Failed to save attendance.' });
  }
});

function cleanupUploadedFile(file?: Express.Multer.File) {
  if (!file?.filename) return;
  const safePath = resolveSafeUploadPath(UPLOADS_DIR, file.filename);
  if (safePath && fs.existsSync(safePath)) {
    try {
      fs.unlinkSync(safePath);
    } catch {
      // ignore cleanup error
    }
  }
}

function handleOptionalFileUpload(req: AuthRequest, res: any, next: any) {
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.includes('multipart/form-data')) {
    return next();
  }
  upload.single('file')(req, res, (err: any) => {
    if (!err) return next();
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: `Attachment exceeds the ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB maximum file size.`,
      });
    }
    return res.status(400).json({
      error: err?.message || 'Invalid file attachment.',
    });
  });
}

// Create Homework (supports optional file attachment)
const homeworkSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().min(3).max(2000),
  classId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
});

router.post('/homework', handleOptionalFileUpload, async (req: AuthRequest, res) => {
  const parsed = homeworkSchema.safeParse(req.body);
  if (!parsed.success) {
    cleanupUploadedFile(req.file);
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid homework data.' });
  }
  const user = req.authUser!;
  if (user.role === 'TEACHER') {
    const allowed = await isTeacherClassTeacherOfClass(user.id, parsed.data.classId);
    if (!allowed) {
      cleanupUploadedFile(req.file);
      return res.status(403).json({ error: 'Not authorized to post homework for this class.' });
    }
  }

  try {
    const attachmentName = req.file ? path.basename(req.file.originalname).slice(0, 200) : null;
    const attachmentUrl = req.file ? `/api/files/uploads/${req.file.filename}` : null;

    const [created] = await db
      .insert(homework)
      .values({
        ...parsed.data,
        title: parsed.data.title.trim(),
        description: parsed.data.description.trim(),
        teacherId: user.id,
        attachmentName,
        attachmentUrl,
      })
      .returning();

    await notifyClassParentsAndStudents(
      parsed.data.classId,
      'New Homework Added',
      `${parsed.data.title.trim()} — Due ${parsed.data.dueDate}`,
      'HOMEWORK',
      'homework'
    );
    await logAudit(
      user,
      'CREATE_HOMEWORK',
      'homework',
      created.id,
      `${user.fullName} posted homework "${created.title}"${attachmentName ? ` with file "${attachmentName}"` : ''}.`
    );
    return res.status(201).json(created);
  } catch (err) {
    cleanupUploadedFile(req.file);
    console.error('Create homework error:', err);
    return res.status(500).json({ error: 'Failed to create homework.' });
  }
});

// Create Assignment (supports optional file attachment)
const assignmentSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().min(3).max(2000),
  classId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxScore: z.coerce.number().int().min(1).max(500).default(25),
});

router.post('/assignments', handleOptionalFileUpload, async (req: AuthRequest, res) => {
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    cleanupUploadedFile(req.file);
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid assignment data.' });
  }
  const user = req.authUser!;
  if (user.role === 'TEACHER') {
    const allowed = await isTeacherClassTeacherOfClass(user.id, parsed.data.classId);
    if (!allowed) {
      cleanupUploadedFile(req.file);
      return res.status(403).json({ error: 'Not authorized to create assignments for this class.' });
    }
  }
  try {
    const attachmentName = req.file ? path.basename(req.file.originalname).slice(0, 200) : null;
    const attachmentUrl = req.file ? `/api/files/uploads/${req.file.filename}` : null;

    const [created] = await db
      .insert(assignments)
      .values({
        ...parsed.data,
        title: parsed.data.title.trim(),
        description: parsed.data.description.trim(),
        teacherId: user.id,
        attachmentName,
        attachmentUrl,
      })
      .returning();

    await notifyClassParentsAndStudents(
      parsed.data.classId,
      'New Assignment Created',
      `${created.title} (Max ${created.maxScore} pts) — Due ${created.dueDate}`,
      'HOMEWORK',
      'homework'
    );
    await logAudit(
      user,
      'CREATE_ASSIGNMENT',
      'assignments',
      created.id,
      `${user.fullName} created assignment "${created.title}"${attachmentName ? ` with file "${attachmentName}"` : ''}.`
    );
    return res.status(201).json(created);
  } catch (err) {
    cleanupUploadedFile(req.file);
    console.error('Create assignment error:', err);
    return res.status(500).json({ error: 'Failed to create assignment.' });
  }
});

// Upload Study Notes (supports multipart file upload OR text note)
router.post('/notes', upload.single('file'), async (req: AuthRequest, res) => {
  const user = req.authUser!;
  const title = String(req.body.title || '').trim();
  const chapter = String(req.body.chapter || '').trim();
  const topic = String(req.body.topic || '').trim();
  const content = String(req.body.content || '').trim();
  const classId = Number(req.body.classId);
  const subjectId = Number(req.body.subjectId);

  if (!title || !chapter || !topic || !Number.isInteger(classId) || !Number.isInteger(subjectId)) {
    return res.status(400).json({ error: 'Title, chapter, topic, class, and subject are required.' });
  }

  if (user.role === 'TEACHER') {
    const allowed = await isTeacherClassTeacherOfClass(user.id, classId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to upload notes for this class.' });
    }
  }

  try {
    const [currentYear] = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.isCurrent, true))
      .limit(1);

    let fileName = `${title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}.txt`;
    let fileType = 'Text Study Note';
    let fileSizeBytes = Buffer.byteLength(content || title, 'utf8');
    let fileUrl = '';

    if (req.file) {
      fileName = req.file.originalname;
      fileType = path.extname(req.file.originalname).replace('.', '').toUpperCase() || 'FILE';
      fileSizeBytes = req.file.size;
      fileUrl = `/api/files/uploads/${req.file.filename}`;
    } else {
      const safeName = sanitizeStoredFilename(fileName);
      const dest = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(dest, `${title}\n${chapter} — ${topic}\n\n${content || 'Study material uploaded by teacher.'}`, 'utf8');
      fileUrl = `/api/files/uploads/${safeName}`;
    }

    const [created] = await db
      .insert(notes)
      .values({
        title,
        chapter,
        topic,
        content: content || null,
        classId,
        subjectId,
        teacherId: user.id,
        academicYearId: currentYear?.id || 1,
        fileName,
        fileType,
        fileSizeBytes,
        fileUrl,
      })
      .returning();

    await notifyClassParentsAndStudents(
      classId,
      'New Study Material Uploaded',
      `${title} (${chapter}) is now available in the Digital Notes Library.`,
      'NOTES',
      'notes'
    );
    await logAudit(
      user,
      'UPLOAD_NOTES',
      'notes',
      created.id,
      `${user.fullName} uploaded study notes "${created.title}".`
    );

    return res.status(201).json(created);
  } catch (err) {
    console.error('Upload notes error:', err);
    return res.status(500).json({ error: 'Failed to upload study notes.' });
  }
});

// Add Teacher Remark
const remarkSchema = z.object({
  studentId: z.number().int().positive(),
  subjectId: z.number().int().positive().optional(),
  remark: z.string().min(3).max(500),
  category: z.enum(['ACADEMIC', 'BEHAVIOR', 'PROGRESS']).default('ACADEMIC'),
});

router.post('/remarks', async (req: AuthRequest, res) => {
  const parsed = remarkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid remark.' });
  }
  const user = req.authUser!;
  try {
    const [stu] = await db
      .select()
      .from(students)
      .where(eq(students.id, parsed.data.studentId))
      .limit(1);

    if (!stu) return res.status(404).json({ error: 'Student not found.' });
    if (user.role === 'TEACHER') {
      const allowed = await isTeacherClassTeacherOfClass(user.id, stu.classId);
      if (!allowed) {
        return res.status(403).json({ error: 'Not authorized to add remarks for this student.' });
      }
    }

    const [created] = await db
      .insert(teacherRemarks)
      .values({
        studentId: stu.id,
        teacherId: user.id,
        subjectId: parsed.data.subjectId || null,
        remark: parsed.data.remark.trim(),
        category: parsed.data.category,
      })
      .returning();

    const links = await db
      .select({ parentId: parentStudentLinks.parentId })
      .from(parentStudentLinks)
      .where(eq(parentStudentLinks.studentId, stu.id));

    if (links.length > 0) {
      await db.insert(notifications).values(
        links.map((l) => ({
          userId: l.parentId,
          title: 'New Teacher Remark',
          message: `${user.fullName} added a remark for ${stu.fullName}.`,
          type: 'REMARK',
          linkTab: 'overview',
        }))
      );
    }

    await logAudit(
      user,
      'ADD_REMARK',
      'teacher_remarks',
      created.id,
      `${user.fullName} added a ${created.category} remark for ${stu.fullName}.`
    );

    return res.status(201).json(created);
  } catch (err) {
    console.error('Add remark error:', err);
    return res.status(500).json({ error: 'Failed to save remark.' });
  }
});

// Add Exam Schedule
const examSchema = z.object({
  name: z.string().min(2).max(120),
  examGroup: z.string().min(2).max(120).default('Term 2 Assessments'),
  classId: z.number().int().positive().nullable().optional(),
  subjectId: z.number().int().positive().nullable().optional(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().min(2).max(30).default('09:00 AM'),
  durationMinutes: z.number().int().min(15).max(360).default(180),
  maxMarks: z.number().int().min(10).max(500).default(100),
  room: z.string().max(60).default('Main Exam Hall'),
});

router.post('/exams', async (req: AuthRequest, res) => {
  const parsed = examSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid exam schedule.' });
  }
  const user = req.authUser!;
  if (user.role === 'TEACHER' && parsed.data.classId) {
    const allowed = await isTeacherClassTeacherOfClass(user.id, parsed.data.classId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to schedule exams for this class.' });
    }
  }
  try {
    const [currentYear] = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.isCurrent, true))
      .limit(1);

    const [created] = await db
      .insert(exams)
      .values({
        ...parsed.data,
        classId: parsed.data.classId || null,
        subjectId: parsed.data.subjectId || null,
        academicYearId: currentYear?.id || 1,
        createdById: user.id,
      })
      .returning();

    await db.insert(schoolEvents).values({
      title: created.name,
      description: `${created.examGroup} · ${created.startTime} (${created.durationMinutes} mins)`,
      eventType: 'EXAM',
      eventDate: created.examDate,
      startTime: created.startTime,
      location: created.room || 'Exam Hall',
      classId: created.classId,
      createdById: user.id,
    });

    await logAudit(
      user,
      'CREATE_EXAM',
      'exams',
      created.id,
      `${user.fullName} scheduled exam "${created.name}" on ${created.examDate}.`
    );

    return res.status(201).json(created);
  } catch (err) {
    console.error('Create exam error:', err);
    return res.status(500).json({ error: 'Failed to schedule exam.' });
  }
});

// Publish Notice
const noticeSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(5).max(2500),
  category: z.enum(['ANNOUNCEMENT', 'EXAM', 'HOLIDAY', 'PTM', 'EVENT', 'EMERGENCY']).default('ANNOUNCEMENT'),
  priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).default('NORMAL'),
  isPinned: z.boolean().default(false),
  targetRole: z.enum(['ALL', 'TEACHER', 'PARENT', 'STUDENT']).default('ALL'),
  expiryDate: z.string().optional(),
  notifyUsers: z.boolean().default(true),
});

router.post('/notices', async (req: AuthRequest, res) => {
  const parsed = noticeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid notice data.' });
  }
  const user = req.authUser!;
  try {
    const [created] = await db
      .insert(notices)
      .values({
        title: parsed.data.title.trim(),
        description: parsed.data.description.trim(),
        category: parsed.data.category,
        priority: parsed.data.priority,
        isPinned: parsed.data.isPinned,
        targetRole: parsed.data.targetRole,
        authorId: user.id,
        expiryDate: parsed.data.expiryDate || null,
      })
      .returning();

    if (parsed.data.notifyUsers) {
      const targetUsers =
        parsed.data.targetRole === 'ALL'
          ? await db.select({ id: users.id }).from(users).where(eq(users.isActive, true)).limit(120)
          : await db
              .select({ id: users.id })
              .from(users)
              .where(and(eq(users.role, parsed.data.targetRole), eq(users.isActive, true)))
              .limit(120);

      if (targetUsers.length > 0) {
        await db.insert(notifications).values(
          targetUsers.map((u) => ({
            userId: u.id,
            title: `Notice: ${created.title}`,
            message: created.description.slice(0, 140),
            type: 'NOTICE',
            linkTab: 'notices',
          }))
        );
      }
    }

    await logAudit(
      user,
      'PUBLISH_NOTICE',
      'notices',
      created.id,
      `${user.fullName} published ${created.priority} notice "${created.title}".`
    );

    return res.status(201).json(created);
  } catch (err) {
    console.error('Publish notice error:', err);
    return res.status(500).json({ error: 'Failed to publish notice.' });
  }
});

// Post Campus Media / Gallery Update
router.post('/gallery', upload.single('image'), async (req: AuthRequest, res) => {
  const user = req.authUser!;
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const albumName = String(req.body.albumName || 'Campus Life').trim();
  const eventDate = String(req.body.eventDate || new Date().toISOString().slice(0, 10)).trim();
  const providedUrl = String(req.body.imageUrl || '').trim();

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }

  let imageUrl = '/src/assets/images/gallery_science_fair_1795258860582.jpg';
  if (req.file) {
    imageUrl = `/api/media/${req.file.filename}`;
  } else if (providedUrl) {
    imageUrl = providedUrl;
  }

  try {
    const [created] = await db
      .insert(galleryItems)
      .values({
        title,
        description,
        albumName,
        eventDate,
        imageUrl,
        postedById: user.id,
      })
      .returning();

    await logAudit(
      user,
      'POST_GALLERY',
      'gallery_items',
      created.id,
      `${user.fullName} published campus gallery update "${created.title}".`
    );
    return res.status(201).json(created);
  } catch (err) {
    console.error('Post gallery error:', err);
    return res.status(500).json({ error: 'Failed to publish gallery update.' });
  }
});

// Upload Student Activity Photo / Video (up to 2 GB; minimum 1 GB+ supported)
router.post('/students/:id/activities', async (req: AuthRequest, res) => {
  const studentId = Number(req.params.id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: 'Invalid student ID.' });
  }

  const user = req.authUser!;
  try {
    const allowed = await canClassTeacherManageStudent(user, studentId);
    if (!allowed) {
      return res.status(403).json({
        error: 'Access denied. Class teachers can only upload activity media for students in their assigned class.',
      });
    }

    const [stu] = await db
      .select({ id: students.id, fullName: students.fullName, classId: students.classId, userId: students.userId })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    if (!stu) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Prevent socket timeout during multi-hundred MB / 1GB+ video uploads
    req.setTimeout(0);

    await new Promise<void>((resolve, reject) => {
      activityUpload.single('media')(req, res, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!req.file) {
      return res.status(400).json({ error: 'Please select a photo or video file to upload.' });
    }

    const description = String(req.body.description || '').trim();
    const rawTitle = String(req.body.title || '').trim();
    const rawDate = String(req.body.activityDate || '').trim();
    const activityDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : new Date().toISOString().slice(0, 10);

    if (description.length < 3 || description.length > 2000) {
      const cleanupPath = resolveSafeUploadPath(ACTIVITY_UPLOADS_DIR, req.file.filename);
      if (cleanupPath && fs.existsSync(cleanupPath)) fs.unlinkSync(cleanupPath);
      return res.status(400).json({ error: 'Activity description must be between 3 and 2000 characters.' });
    }

    const title = (rawTitle || 'Student Activity').slice(0, 140);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const mediaType: 'IMAGE' | 'VIDEO' = ALLOWED_ACTIVITY_VIDEO_EXTS.has(ext) ? 'VIDEO' : 'IMAGE';
    const mimeType =
      req.file.mimetype ||
      (mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg');

    const [created] = await db
      .insert(studentActivities)
      .values({
        studentId: stu.id,
        classId: stu.classId,
        uploadedById: user.id,
        title,
        description,
        activityDate,
        mediaType,
        fileName: path.basename(req.file.originalname).slice(0, 200),
        storedFilename: req.file.filename,
        mimeType,
        fileSizeBytes: req.file.size,
      })
      .returning();

    // Notify linked parents & student
    const links = await db
      .select({ parentId: parentStudentLinks.parentId })
      .from(parentStudentLinks)
      .where(eq(parentStudentLinks.studentId, stu.id));

    const targetIds = new Set<number>(links.map((l) => l.parentId));
    if (stu.userId) targetIds.add(stu.userId);

    if (targetIds.size > 0) {
      await db.insert(notifications).values(
        Array.from(targetIds).map((uid) => ({
          userId: uid,
          title: `New Student Activity ${mediaType === 'VIDEO' ? 'Video' : 'Photo'}`,
          message: `${user.fullName} uploaded "${title}" for ${stu.fullName}.`,
          type: 'NOTICE',
          linkTab: 'profile',
        }))
      );
    }

    await logAudit(
      user,
      'UPLOAD_STUDENT_ACTIVITY',
      'student_activities',
      created.id,
      `${user.fullName} uploaded ${mediaType.toLowerCase()} "${title}" (${(req.file.size / (1024 * 1024)).toFixed(1)} MB) for ${stu.fullName}.`
    );

    const mediaToken = signMediaAccessToken({ userId: user.id, activityId: created.id });
    return res.status(201).json({
      id: created.id,
      studentId: created.studentId,
      classId: created.classId,
      title: created.title,
      description: created.description,
      activityDate: created.activityDate,
      mediaType: created.mediaType,
      fileName: created.fileName,
      mimeType: created.mimeType,
      fileSizeBytes: created.fileSizeBytes,
      mediaUrl: `/api/student-activities/${created.id}/media?mt=${encodeURIComponent(mediaToken)}`,
      uploadedByName: user.fullName,
      createdAt: created.createdAt,
    });
  } catch (err: any) {
    if (req.file?.filename) {
      const cleanupPath = resolveSafeUploadPath(ACTIVITY_UPLOADS_DIR, req.file.filename);
      if (cleanupPath && fs.existsSync(cleanupPath)) {
        try {
          fs.unlinkSync(cleanupPath);
        } catch {
          // ignore cleanup failure
        }
      }
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File exceeds the 2 GB maximum upload limit.',
      });
    }
    if (err instanceof Error && err.message.startsWith('Unsupported media format')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Upload student activity error:', err);
    return res.status(500).json({ error: 'Failed to upload student activity media.' });
  }
});

// Delete Student Activity Photo / Video
router.delete('/activities/:activityId', async (req: AuthRequest, res) => {
  const activityId = Number(req.params.activityId);
  if (!Number.isInteger(activityId) || activityId <= 0) {
    return res.status(400).json({ error: 'Invalid activity ID.' });
  }

  const user = req.authUser!;
  try {
    const [existing] = await db
      .select()
      .from(studentActivities)
      .where(eq(studentActivities.id, activityId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Activity record not found.' });
    }

    const allowed = await canClassTeacherManageStudent(user, existing.studentId);
    if (!allowed) {
      return res.status(403).json({
        error: 'Access denied. You can only delete activity media for students in your assigned class.',
      });
    }

    await db.delete(studentActivities).where(eq(studentActivities.id, activityId));

    const safePath = resolveSafeUploadPath(ACTIVITY_UPLOADS_DIR, existing.storedFilename);
    if (safePath && fs.existsSync(safePath)) {
      try {
        fs.unlinkSync(safePath);
      } catch {
        // ignore missing file cleanup
      }
    }

    await logAudit(
      user,
      'DELETE_STUDENT_ACTIVITY',
      'student_activities',
      activityId,
      `${user.fullName} deleted activity "${existing.title}" for student #${existing.studentId}.`
    );

    return res.json({ message: 'Activity media deleted.' });
  } catch (err) {
    console.error('Delete student activity error:', err);
    return res.status(500).json({ error: 'Failed to delete student activity.' });
  }
});

export default router;
