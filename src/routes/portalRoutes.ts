import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import QRCode from 'qrcode';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  assignments,
  attendance,
  auditLogs,
  classes,
  classSubjects,
  classTimetables,
  exams,
  feePayments,
  feeRecords,
  galleryItems,
  homework,
  marks,
  messages,
  notes,
  notices,
  notifications,
  parentStudentLinks,
  schoolEvents,
  schoolSettings,
  studentActivities,
  students,
  subjects,
  teacherRemarks,
  users,
} from '../db/schema.ts';
import {
  AuthRequest,
  canAccessStudent,
  getAssignedHomeroomClassIds,
  requireAuth,
} from '../middleware/auth.ts';
import {
  buildUpiPaymentLinks,
  isValidTransactionRef,
  isValidUpiVpa,
  normalizeIndianPhone,
  resolveSafeUploadPath,
  signMediaAccessToken,
  signPaymentIntentToken,
  UserRole,
  verifyMediaAccessToken,
  verifyPaymentIntentToken,
  verifyRazorpaySignature,
  verifySessionToken,
} from '../utils/security.ts';

const router = Router();
const ACTIVITY_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'activities');

// Public school branding settings (no sensitive student/user data)
router.get('/school/settings', async (_req, res) => {
  try {
    const [settings] = await db.select().from(schoolSettings).limit(1);
    return res.json(settings || null);
  } catch (err) {
    console.error('Error fetching school settings:', err);
    return res.status(500).json({ error: 'Failed to load school configuration.' });
  }
});

async function getAuthorizedClassIds(user: NonNullable<AuthRequest['authUser']>): Promise<number[]> {
  if (user.role === 'ADMIN') {
    const all = await db.select({ id: classes.id }).from(classes);
    return all.map((c) => c.id);
  }
  if (user.role === 'TEACHER') {
    return getAssignedHomeroomClassIds(user.id);
  }
  if (user.role === 'PARENT') {
    const linked = await db
      .select({ classId: students.classId })
      .from(parentStudentLinks)
      .innerJoin(students, eq(parentStudentLinks.studentId, students.id))
      .where(eq(parentStudentLinks.parentId, user.id));
    return Array.from(new Set(linked.map((l) => l.classId)));
  }
  if (user.role === 'STUDENT') {
    const [stu] = await db
      .select({ classId: students.classId })
      .from(students)
      .where(eq(students.userId, user.id))
      .limit(1);
    return stu ? [stu.classId] : [];
  }
  return [];
}

// Student overview (strictly enforces Parent-Child, Student-Self, Teacher-Class, Admin RBAC)
router.get('/students/:studentId/overview', requireAuth, async (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: 'Invalid student identifier.' });
  }

  try {
    const allowed = await canAccessStudent(req.authUser!, studentId);
    if (!allowed) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to view this student record.',
      });
    }

    const [student] = await db
      .select({
        id: students.id,
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
      })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(eq(students.id, studentId))
      .limit(1);

    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Student marks with subject & exam metadata
    const studentMarks = await db
      .select({
        id: marks.id,
        subjectId: subjects.id,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        examId: exams.id,
        examName: exams.name,
        examDate: exams.examDate,
        obtainedMarks: marks.obtainedMarks,
        maxMarks: marks.maxMarks,
        grade: marks.grade,
        teacherRemark: marks.teacherRemark,
      })
      .from(marks)
      .innerJoin(subjects, eq(marks.subjectId, subjects.id))
      .innerJoin(exams, eq(marks.examId, exams.id))
      .where(eq(marks.studentId, studentId))
      .orderBy(desc(exams.examDate), subjects.name);

    // Anonymized class averages (aggregates ONLY, never exposing peer student IDs or names)
    const classAvgRows = await db
      .select({
        subjectId: marks.subjectId,
        examId: marks.examId,
        avgPct: sql<number>`ROUND(AVG(${marks.obtainedMarks}::numeric / NULLIF(${marks.maxMarks}, 0) * 100), 1)`,
      })
      .from(marks)
      .where(eq(marks.classId, student.classId))
      .groupBy(marks.subjectId, marks.examId);

    const avgMap = new Map<string, number>();
    for (const row of classAvgRows) {
      avgMap.set(`${row.examId}:${row.subjectId}`, Number(row.avgPct));
    }

    const enrichedMarks = studentMarks.map((m) => ({
      ...m,
      percentage: m.maxMarks > 0 ? Math.round((m.obtainedMarks / m.maxMarks) * 1000) / 10 : 0,
      classAveragePct: avgMap.get(`${m.examId}:${m.subjectId}`) ?? null,
    }));

    // Attendance records
    const attRows = await db
      .select({
        id: attendance.id,
        date: attendance.date,
        status: attendance.status,
        note: attendance.note,
      })
      .from(attendance)
      .where(eq(attendance.studentId, studentId))
      .orderBy(desc(attendance.date));

    const schoolDays = attRows.filter((a) => a.status !== 'HOLIDAY');
    const presentDays = schoolDays.filter((a) => a.status === 'PRESENT').length;
    const lateDays = schoolDays.filter((a) => a.status === 'LATE').length;
    const absentDays = schoolDays.filter((a) => a.status === 'ABSENT').length;
    const excusedDays = schoolDays.filter((a) => a.status === 'EXCUSED').length;
    const attendancePct =
      schoolDays.length > 0
        ? Math.round(((presentDays + lateDays) / schoolDays.length) * 1000) / 10
        : 100;

    // Class homework & assignments
    const classHomework = await db
      .select({
        id: homework.id,
        title: homework.title,
        description: homework.description,
        dueDate: homework.dueDate,
        priority: homework.priority,
        attachmentName: homework.attachmentName,
        attachmentUrl: homework.attachmentUrl,
        subjectName: subjects.name,
        teacherName: users.fullName,
      })
      .from(homework)
      .innerJoin(subjects, eq(homework.subjectId, subjects.id))
      .innerJoin(users, eq(homework.teacherId, users.id))
      .where(eq(homework.classId, student.classId))
      .orderBy(homework.dueDate);

    const classAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        dueDate: assignments.dueDate,
        maxScore: assignments.maxScore,
        status: assignments.status,
        attachmentName: assignments.attachmentName,
        attachmentUrl: assignments.attachmentUrl,
        subjectName: subjects.name,
        teacherName: users.fullName,
      })
      .from(assignments)
      .innerJoin(subjects, eq(assignments.subjectId, subjects.id))
      .innerJoin(users, eq(assignments.teacherId, users.id))
      .where(eq(assignments.classId, student.classId))
      .orderBy(assignments.dueDate);

    const upcomingExams = await db
      .select({
        id: exams.id,
        name: exams.name,
        examGroup: exams.examGroup,
        examDate: exams.examDate,
        startTime: exams.startTime,
        durationMinutes: exams.durationMinutes,
        maxMarks: exams.maxMarks,
        room: exams.room,
        subjectName: subjects.name,
      })
      .from(exams)
      .leftJoin(subjects, eq(exams.subjectId, subjects.id))
      .where(
        and(
          or(eq(exams.classId, student.classId), sql`${exams.classId} IS NULL`),
          sql`${exams.examDate} >= '2026-11-01'`
        )
      )
      .orderBy(exams.examDate);

    const remarks = await db
      .select({
        id: teacherRemarks.id,
        remark: teacherRemarks.remark,
        category: teacherRemarks.category,
        createdAt: teacherRemarks.createdAt,
        teacherName: users.fullName,
        subjectName: subjects.name,
      })
      .from(teacherRemarks)
      .innerJoin(users, eq(teacherRemarks.teacherId, users.id))
      .leftJoin(subjects, eq(teacherRemarks.subjectId, subjects.id))
      .where(eq(teacherRemarks.studentId, studentId))
      .orderBy(desc(teacherRemarks.createdAt));

    const classSubjectsList = await db
      .select({
        subjectId: subjects.id,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        teacherId: users.id,
        teacherName: users.fullName,
        teacherUsername: users.username,
      })
      .from(classSubjects)
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .innerJoin(users, eq(classSubjects.teacherId, users.id))
      .where(eq(classSubjects.classId, student.classId));

    // Compute smart insights objectively from real DB metrics
    const insights: string[] = [];
    const examGroups = Array.from(new Set(enrichedMarks.map((m) => m.examName)));
    if (examGroups.length >= 2) {
      const latestExam = examGroups[0];
      const prevExam = examGroups[1];
      const latestRows = enrichedMarks.filter((m) => m.examName === latestExam);
      const prevRows = enrichedMarks.filter((m) => m.examName === prevExam);
      for (const lr of latestRows) {
        const pr = prevRows.find((p) => p.subjectId === lr.subjectId);
        if (pr && lr.percentage > pr.percentage) {
          insights.push(
            `${lr.subjectName} performance improved by +${Math.round(lr.percentage - pr.percentage)}% compared with ${prevExam}.`
          );
          break;
        }
      }
    }
    insights.push(`Attendance stands at ${attendancePct}% across ${schoolDays.length} recorded school days.`);
    if (classHomework.length > 0) {
      insights.push(`${classHomework.length} active homework tasks and ${classAssignments.length} assignments are scheduled.`);
    }

    const activityRows = await db
      .select({
        id: studentActivities.id,
        studentId: studentActivities.studentId,
        classId: studentActivities.classId,
        title: studentActivities.title,
        description: studentActivities.description,
        activityDate: studentActivities.activityDate,
        mediaType: studentActivities.mediaType,
        fileName: studentActivities.fileName,
        mimeType: studentActivities.mimeType,
        fileSizeBytes: studentActivities.fileSizeBytes,
        uploadedByName: users.fullName,
        createdAt: studentActivities.createdAt,
      })
      .from(studentActivities)
      .innerJoin(users, eq(studentActivities.uploadedById, users.id))
      .where(eq(studentActivities.studentId, studentId))
      .orderBy(desc(studentActivities.activityDate), desc(studentActivities.createdAt));

    const activities = activityRows.map((a) => ({
      ...a,
      mediaUrl: `/api/student-activities/${a.id}/media?mt=${encodeURIComponent(
        signMediaAccessToken({ userId: req.authUser!.id, activityId: a.id })
      )}`,
    }));

    return res.json({
      student,
      marks: enrichedMarks,
      attendance: {
        records: attRows,
        summary: {
          totalSchoolDays: schoolDays.length,
          present: presentDays,
          late: lateDays,
          absent: absentDays,
          excused: excusedDays,
          percentage: attendancePct,
        },
      },
      homework: classHomework,
      assignments: classAssignments,
      upcomingExams,
      remarks,
      subjects: classSubjectsList,
      insights,
      activities,
    });
  } catch (err) {
    console.error('Error loading student overview:', err);
    return res.status(500).json({ error: 'Failed to load student overview.' });
  }
});

// Scoped Homework list
router.get('/homework', requireAuth, async (req: AuthRequest, res) => {
  try {
    const classIds = await getAuthorizedClassIds(req.authUser!);
    if (classIds.length === 0) return res.json([]);

    const requestedClassId = req.query.classId ? Number(req.query.classId) : null;
    const filterIds =
      requestedClassId && classIds.includes(requestedClassId)
        ? [requestedClassId]
        : classIds;

    const rows = await db
      .select({
        id: homework.id,
        title: homework.title,
        description: homework.description,
        classId: homework.classId,
        className: classes.name,
        section: classes.section,
        subjectId: homework.subjectId,
        subjectName: subjects.name,
        teacherName: users.fullName,
        dueDate: homework.dueDate,
        priority: homework.priority,
        attachmentName: homework.attachmentName,
        attachmentUrl: homework.attachmentUrl,
        createdAt: homework.createdAt,
      })
      .from(homework)
      .innerJoin(classes, eq(homework.classId, classes.id))
      .innerJoin(subjects, eq(homework.subjectId, subjects.id))
      .innerJoin(users, eq(homework.teacherId, users.id))
      .where(inArray(homework.classId, filterIds))
      .orderBy(homework.dueDate);

    return res.json(rows);
  } catch (err) {
    console.error('Failed to fetch homework:', err);
    return res.status(500).json({ error: 'Failed to load homework.' });
  }
});

// Scoped Assignments list
router.get('/assignments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const classIds = await getAuthorizedClassIds(req.authUser!);
    if (classIds.length === 0) return res.json([]);

    const requestedClassId = req.query.classId ? Number(req.query.classId) : null;
    const filterIds =
      requestedClassId && classIds.includes(requestedClassId)
        ? [requestedClassId]
        : classIds;

    const rows = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        classId: assignments.classId,
        className: classes.name,
        section: classes.section,
        subjectId: assignments.subjectId,
        subjectName: subjects.name,
        teacherName: users.fullName,
        dueDate: assignments.dueDate,
        maxScore: assignments.maxScore,
        status: assignments.status,
        attachmentName: assignments.attachmentName,
        attachmentUrl: assignments.attachmentUrl,
        createdAt: assignments.createdAt,
      })
      .from(assignments)
      .innerJoin(classes, eq(assignments.classId, classes.id))
      .innerJoin(subjects, eq(assignments.subjectId, subjects.id))
      .innerJoin(users, eq(assignments.teacherId, users.id))
      .where(inArray(assignments.classId, filterIds))
      .orderBy(assignments.dueDate);

    return res.json(rows);
  } catch (err) {
    console.error('Failed to fetch assignments:', err);
    return res.status(500).json({ error: 'Failed to load assignments.' });
  }
});

// Scoped Digital Study Notes Library
router.get('/notes', requireAuth, async (req: AuthRequest, res) => {
  try {
    const classIds = await getAuthorizedClassIds(req.authUser!);
    if (classIds.length === 0) return res.json([]);

    const requestedClassId = req.query.classId ? Number(req.query.classId) : null;
    const filterIds =
      requestedClassId && classIds.includes(requestedClassId)
        ? [requestedClassId]
        : classIds;

    const rows = await db
      .select({
        id: notes.id,
        title: notes.title,
        chapter: notes.chapter,
        topic: notes.topic,
        content: notes.content,
        classId: notes.classId,
        className: classes.name,
        section: classes.section,
        subjectId: notes.subjectId,
        subjectName: subjects.name,
        teacherName: users.fullName,
        fileName: notes.fileName,
        fileType: notes.fileType,
        fileSizeBytes: notes.fileSizeBytes,
        fileUrl: notes.fileUrl,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .innerJoin(classes, eq(notes.classId, classes.id))
      .innerJoin(subjects, eq(notes.subjectId, subjects.id))
      .innerJoin(users, eq(notes.teacherId, users.id))
      .where(inArray(notes.classId, filterIds))
      .orderBy(desc(notes.createdAt));

    return res.json(rows);
  } catch (err) {
    console.error('Failed to load notes:', err);
    return res.status(500).json({ error: 'Failed to load study notes.' });
  }
});

// Exam Timetable
router.get('/exams', requireAuth, async (req: AuthRequest, res) => {
  try {
    const classIds = await getAuthorizedClassIds(req.authUser!);
    const rows = await db
      .select({
        id: exams.id,
        name: exams.name,
        examGroup: exams.examGroup,
        classId: exams.classId,
        className: classes.name,
        section: classes.section,
        subjectId: exams.subjectId,
        subjectName: subjects.name,
        examDate: exams.examDate,
        startTime: exams.startTime,
        durationMinutes: exams.durationMinutes,
        maxMarks: exams.maxMarks,
        room: exams.room,
      })
      .from(exams)
      .leftJoin(classes, eq(exams.classId, classes.id))
      .leftJoin(subjects, eq(exams.subjectId, subjects.id))
      .orderBy(exams.examDate);

    const filtered =
      req.authUser!.role === 'ADMIN'
        ? rows
        : rows.filter((r) => r.classId === null || classIds.includes(r.classId));

    return res.json(filtered);
  } catch (err) {
    console.error('Failed to load exams:', err);
    return res.status(500).json({ error: 'Failed to load exam timetable.' });
  }
});

// School Notice Board
router.get('/notices', requireAuth, async (req: AuthRequest, res) => {
  try {
    const role = req.authUser!.role;
    const rows = await db
      .select({
        id: notices.id,
        title: notices.title,
        description: notices.description,
        category: notices.category,
        priority: notices.priority,
        isPinned: notices.isPinned,
        targetRole: notices.targetRole,
        targetClassId: notices.targetClassId,
        authorName: users.fullName,
        authorRole: users.role,
        attachmentName: notices.attachmentName,
        attachmentUrl: notices.attachmentUrl,
        expiryDate: notices.expiryDate,
        createdAt: notices.createdAt,
      })
      .from(notices)
      .innerJoin(users, eq(notices.authorId, users.id))
      .orderBy(desc(notices.isPinned), desc(notices.createdAt));

    const visible =
      role === 'ADMIN'
        ? rows
        : rows.filter((n) => n.targetRole === 'ALL' || n.targetRole === role);

    return res.json(visible);
  } catch (err) {
    console.error('Failed to load notices:', err);
    return res.status(500).json({ error: 'Failed to load notice board.' });
  }
});

// School Calendar Events
router.get('/events', requireAuth, async (req: AuthRequest, res) => {
  try {
    const classIds = await getAuthorizedClassIds(req.authUser!);
    const rows = await db
      .select({
        id: schoolEvents.id,
        title: schoolEvents.title,
        description: schoolEvents.description,
        eventType: schoolEvents.eventType,
        eventDate: schoolEvents.eventDate,
        endDate: schoolEvents.endDate,
        startTime: schoolEvents.startTime,
        location: schoolEvents.location,
        classId: schoolEvents.classId,
      })
      .from(schoolEvents)
      .orderBy(schoolEvents.eventDate);

    const filtered =
      req.authUser!.role === 'ADMIN'
        ? rows
        : rows.filter((e) => e.classId === null || classIds.includes(e.classId));

    return res.json(filtered);
  } catch (err) {
    console.error('Failed to load calendar events:', err);
    return res.status(500).json({ error: 'Failed to load school calendar.' });
  }
});

// Notifications (strictly user's own notifications)
router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.authUser!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(40);
    return res.json(rows);
  } catch (err) {
    console.error('Failed to load notifications:', err);
    return res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.patch('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  const notifId = Number(req.params.id);
  if (!Number.isInteger(notifId) || notifId <= 0) {
    return res.status(400).json({ error: 'Invalid notification ID.' });
  }
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notifId),
          eq(notifications.userId, req.authUser!.id)
        )
      );
    return res.json({ success: true });
  } catch (err) {
    console.error('Failed to mark notification read:', err);
    return res.status(500).json({ error: 'Failed to update notification.' });
  }
});

router.post('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.authUser!.id));
    return res.json({ success: true });
  } catch (err) {
    console.error('Failed to mark all notifications read:', err);
    return res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

// Parent-Teacher Messaging
const messageSchema = z.object({
  recipientId: z.number().int().positive(),
  studentId: z.number().int().positive().optional(),
  subject: z.string().min(2).max(160),
  body: z.string().min(2).max(2000),
});

router.get('/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!.id;
    const rows = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        studentId: messages.studentId,
        subject: messages.subject,
        body: messages.body,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)))
      .orderBy(desc(messages.createdAt))
      .limit(50);

    const userIds = Array.from(
      new Set(rows.flatMap((r) => [r.senderId, r.recipientId]))
    );
    const userRows =
      userIds.length > 0
        ? await db
            .select({ id: users.id, fullName: users.fullName, role: users.role })
            .from(users)
            .where(inArray(users.id, userIds))
        : [];
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    // Contacts available to message
    let contacts: Array<{ id: number; fullName: string; role: string }> = [];
    if (req.authUser!.role === 'PARENT') {
      const classIds = await getAuthorizedClassIds(req.authUser!);
      if (classIds.length > 0) {
        const teacherContacts = await db
          .selectDistinct({
            id: users.id,
            fullName: users.fullName,
            role: users.role,
          })
          .from(classSubjects)
          .innerJoin(users, eq(classSubjects.teacherId, users.id))
          .where(inArray(classSubjects.classId, classIds));
        contacts = teacherContacts;
      }
    } else if (req.authUser!.role === 'TEACHER') {
      const classIds = await getAuthorizedClassIds(req.authUser!);
      if (classIds.length > 0) {
        const parentContacts = await db
          .selectDistinct({
            id: users.id,
            fullName: users.fullName,
            role: users.role,
          })
          .from(students)
          .innerJoin(parentStudentLinks, eq(parentStudentLinks.studentId, students.id))
          .innerJoin(users, eq(parentStudentLinks.parentId, users.id))
          .where(inArray(students.classId, classIds));
        contacts = parentContacts;
      }
    } else if (req.authUser!.role === 'ADMIN') {
      contacts = await db
        .select({ id: users.id, fullName: users.fullName, role: users.role })
        .from(users)
        .where(eq(users.isActive, true))
        .limit(50);
    }

    const enriched = rows.map((m) => ({
      ...m,
      senderName: userMap.get(m.senderId)?.fullName || 'User',
      senderRole: userMap.get(m.senderId)?.role || '',
      recipientName: userMap.get(m.recipientId)?.fullName || 'User',
      recipientRole: userMap.get(m.recipientId)?.role || '',
    }));

    return res.json({ messages: enriched, contacts });
  } catch (err) {
    console.error('Failed to fetch messages:', err);
    return res.status(500).json({ error: 'Failed to load messages.' });
  }
});

router.post('/messages', requireAuth, async (req: AuthRequest, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid message.' });
  }
  if (parsed.data.studentId) {
    const allowed = await canAccessStudent(req.authUser!, parsed.data.studentId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized for the referenced student.' });
    }
  }
  try {
    const [created] = await db
      .insert(messages)
      .values({
        senderId: req.authUser!.id,
        recipientId: parsed.data.recipientId,
        studentId: parsed.data.studentId || null,
        subject: parsed.data.subject.trim(),
        body: parsed.data.body.trim(),
      })
      .returning();

    await db.insert(notifications).values({
      userId: parsed.data.recipientId,
      title: `New message from ${req.authUser!.fullName}`,
      message: parsed.data.subject.trim(),
      type: 'NOTICE',
      linkTab: 'messages',
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('Failed to send message:', err);
    return res.status(500).json({ error: 'Failed to send message.' });
  }
});

// Scoped Global Search
router.get('/search', requireAuth, async (req: AuthRequest, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q || q.length < 2) {
    return res.json({
      notes: [],
      homework: [],
      assignments: [],
      notices: [],
      exams: [],
      students: [],
    });
  }

  try {
    const classIds = await getAuthorizedClassIds(req.authUser!);
    const role = req.authUser!.role;

    const noteRows =
      classIds.length > 0
        ? await db
            .select({
              id: notes.id,
              title: notes.title,
              chapter: notes.chapter,
              topic: notes.topic,
              subjectName: subjects.name,
            })
            .from(notes)
            .innerJoin(subjects, eq(notes.subjectId, subjects.id))
            .where(inArray(notes.classId, classIds))
        : [];

    const hwRows =
      classIds.length > 0
        ? await db
            .select({
              id: homework.id,
              title: homework.title,
              dueDate: homework.dueDate,
              subjectName: subjects.name,
            })
            .from(homework)
            .innerJoin(subjects, eq(homework.subjectId, subjects.id))
            .where(inArray(homework.classId, classIds))
        : [];

    const assignRows =
      classIds.length > 0
        ? await db
            .select({
              id: assignments.id,
              title: assignments.title,
              dueDate: assignments.dueDate,
              subjectName: subjects.name,
            })
            .from(assignments)
            .innerJoin(subjects, eq(assignments.subjectId, subjects.id))
            .where(inArray(assignments.classId, classIds))
        : [];

    const noticeRows = await db
      .select({
        id: notices.id,
        title: notices.title,
        category: notices.category,
        targetRole: notices.targetRole,
      })
      .from(notices);

    const examRows = await db
      .select({
        id: exams.id,
        name: exams.name,
        examDate: exams.examDate,
        classId: exams.classId,
        subjectName: subjects.name,
      })
      .from(exams)
      .leftJoin(subjects, eq(exams.subjectId, subjects.id));

    let studentResults: Array<{
      id: number;
      studentCode: string;
      fullName: string;
      className: string;
      section: string;
    }> = [];

    if ((role === 'ADMIN' || role === 'TEACHER') && classIds.length > 0) {
      const sRows = await db
        .select({
          id: students.id,
          studentCode: students.studentCode,
          fullName: students.fullName,
          className: classes.name,
          section: classes.section,
        })
        .from(students)
        .innerJoin(classes, eq(students.classId, classes.id))
        .where(inArray(students.classId, classIds));
      studentResults = sRows.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.studentCode.toLowerCase().includes(q)
      );
    }

    return res.json({
      notes: noteRows
        .filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.chapter.toLowerCase().includes(q) ||
            n.topic.toLowerCase().includes(q) ||
            n.subjectName.toLowerCase().includes(q)
        )
        .slice(0, 6),
      homework: hwRows
        .filter(
          (h) =>
            h.title.toLowerCase().includes(q) ||
            h.subjectName.toLowerCase().includes(q)
        )
        .slice(0, 6),
      assignments: assignRows
        .filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.subjectName.toLowerCase().includes(q)
        )
        .slice(0, 6),
      notices: noticeRows
        .filter(
          (n) =>
            (role === 'ADMIN' || n.targetRole === 'ALL' || n.targetRole === role) &&
            n.title.toLowerCase().includes(q)
        )
        .slice(0, 6),
      exams: examRows
        .filter(
          (e) =>
            (role === 'ADMIN' || e.classId === null || classIds.includes(e.classId)) &&
            (e.name.toLowerCase().includes(q) || (e.subjectName || '').toLowerCase().includes(q))
        )
        .slice(0, 6),
      students: studentResults.slice(0, 8),
    });
  } catch (err) {
    console.error('Search failed:', err);
    return res.status(500).json({ error: 'Search failed.' });
  }
});

// Class Timetable (Daily & Weekly Period Schedule)
router.get('/timetable', requireAuth, async (req: AuthRequest, res) => {
  try {
    const classIds = await getAuthorizedClassIds(req.authUser!);
    if (classIds.length === 0) return res.json({ classes: [], entries: [] });

    const requestedClassId = req.query.classId ? Number(req.query.classId) : null;
    const filterIds =
      requestedClassId && classIds.includes(requestedClassId)
        ? [requestedClassId]
        : [classIds[0]];

    const authorizedClasses = await db
      .select({
        id: classes.id,
        name: classes.name,
        section: classes.section,
        roomNumber: classes.roomNumber,
      })
      .from(classes)
      .where(inArray(classes.id, classIds))
      .orderBy(classes.name, classes.section);

    const entries = await db
      .select({
        id: classTimetables.id,
        classId: classTimetables.classId,
        className: classes.name,
        section: classes.section,
        dayOfWeek: classTimetables.dayOfWeek,
        periodNumber: classTimetables.periodNumber,
        startTime: classTimetables.startTime,
        endTime: classTimetables.endTime,
        subjectId: subjects.id,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        teacherId: users.id,
        teacherName: users.fullName,
        room: classTimetables.room,
      })
      .from(classTimetables)
      .innerJoin(classes, eq(classTimetables.classId, classes.id))
      .innerJoin(subjects, eq(classTimetables.subjectId, subjects.id))
      .innerJoin(users, eq(classTimetables.teacherId, users.id))
      .where(inArray(classTimetables.classId, filterIds))
      .orderBy(classTimetables.periodNumber);

    return res.json({ classes: authorizedClasses, entries });
  } catch (err) {
    console.error('Failed to fetch class timetable:', err);
    return res.status(500).json({ error: 'Failed to load class timetable.' });
  }
});

// Student Fee Management (strictly enforces canAccessStudent RBAC)
router.get('/students/:studentId/fees', requireAuth, async (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: 'Invalid student identifier.' });
  }
  try {
    const allowed = await canAccessStudent(req.authUser!, studentId);
    if (!allowed) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to view fees for this student.',
      });
    }

    const [records, [settings], [studentRow], [userRow]] = await Promise.all([
      db
        .select()
        .from(feeRecords)
        .where(eq(feeRecords.studentId, studentId))
        .orderBy(desc(feeRecords.dueDate)),
      db.select().from(schoolSettings).limit(1),
      db
        .select({
          id: students.id,
          studentCode: students.studentCode,
          fullName: students.fullName,
          rollNumber: students.rollNumber,
          fatherName: students.fatherName,
          guardianPhone: students.guardianPhone,
          guardianEmail: students.guardianEmail,
          className: classes.name,
          section: classes.section,
        })
        .from(students)
        .innerJoin(classes, eq(students.classId, classes.id))
        .where(eq(students.id, studentId))
        .limit(1),
      db
        .select({
          fullName: users.fullName,
          phone: users.phone,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, req.authUser!.id))
        .limit(1),
    ]);

    const totalPaid = records
      .filter((r) => r.status === 'PAID')
      .reduce((sum, r) => sum + r.amount, 0);
    const totalPending = records
      .filter((r) => r.status === 'PENDING')
      .reduce((sum, r) => sum + r.amount, 0);
    const totalOverdue = records
      .filter((r) => r.status === 'OVERDUE')
      .reduce((sum, r) => sum + r.amount, 0);

    const hasRazorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

    return res.json({
      summary: { totalPaid, totalPending, totalOverdue },
      records,
      merchantConfig: {
        upiId: settings?.merchantUpiId || 'macrovision.fees@okaxis',
        payeeName: settings?.merchantPayeeName || settings?.schoolName || 'Macro Vision Academy Burhanpur',
        bankAccountSummary:
          settings?.bankAccountSummary || 'Axis Bank Burhanpur · A/C ••••4821 · IFSC UTIB0001482',
        gatewayMode: hasRazorpay ? 'RAZORPAY' : 'UPI_DIRECT',
      },
      payerDefaults: studentRow
        ? {
            fullName: userRow?.fullName || studentRow.fatherName || req.authUser!.fullName,
            phone: userRow?.phone || studentRow.guardianPhone || '',
            email: userRow?.email || studentRow.guardianEmail || '',
            studentName: studentRow.fullName,
            studentCode: studentRow.studentCode,
            className: studentRow.className,
            section: studentRow.section,
            rollNumber: studentRow.rollNumber,
            fatherName: studentRow.fatherName || '',
          }
        : undefined,
    });
  } catch (err) {
    console.error('Failed to load fees:', err);
    return res.status(500).json({ error: 'Failed to load fee records.' });
  }
});

const createPaymentIntentSchema = z.object({
  paymentMethod: z.enum([
    'PHONEPE',
    'GOOGLE_PAY',
    'PAYTM',
    'BHIM_UPI',
    'UPI_ID',
    'CARD',
    'NETBANKING',
  ]),
  payerName: z.string().trim().min(2, 'Payer full name is required.').max(120),
  payerPhone: z.string().trim().min(10, 'Valid 10-digit mobile number is required.').max(20),
  payerEmail: z.string().trim().email('Enter a valid receipt email address.').optional().or(z.literal('')),
  payerUpiId: z.string().trim().max(100).optional().or(z.literal('')),
});

// Step 1: Create Server-Authoritative UPI / Gateway Payment Order + QR + Signed Token
router.post('/students/:studentId/fees/:feeId/payment-intent', requireAuth, async (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  const feeId = Number(req.params.feeId);
  if (!Number.isInteger(studentId) || !Number.isInteger(feeId) || studentId <= 0 || feeId <= 0) {
    return res.status(400).json({ error: 'Invalid student or fee identifier.' });
  }

  const user = req.authUser!;
  if (user.role !== 'PARENT' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only parents or administrators can initiate fee payments.' });
  }

  const parsed = createPaymentIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payment details.' });
  }

  const normalizedPhone = normalizeIndianPhone(parsed.data.payerPhone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
  }

  if (parsed.data.paymentMethod === 'UPI_ID') {
    if (!parsed.data.payerUpiId || !isValidUpiVpa(parsed.data.payerUpiId)) {
      return res.status(400).json({ error: 'Please enter a valid UPI ID (e.g. 9876543210@ybl or name@okaxis).' });
    }
  } else if (parsed.data.payerUpiId && !isValidUpiVpa(parsed.data.payerUpiId)) {
    return res.status(400).json({ error: 'Invalid UPI ID format.' });
  }

  try {
    const allowed = await canAccessStudent(user, studentId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to pay fees for this student.' });
    }

    const [[fee], [stu], [settings]] = await Promise.all([
      db
        .select()
        .from(feeRecords)
        .where(and(eq(feeRecords.id, feeId), eq(feeRecords.studentId, studentId)))
        .limit(1),
      db
        .select({
          id: students.id,
          studentCode: students.studentCode,
          fullName: students.fullName,
        })
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1),
      db.select().from(schoolSettings).limit(1),
    ]);

    if (!fee || !stu) {
      return res.status(404).json({ error: 'Fee invoice not found.' });
    }
    if (fee.status === 'PAID') {
      return res.status(409).json({ error: 'This fee invoice has already been paid.' });
    }

    const merchantUpiId = settings?.merchantUpiId || 'macrovision.fees@okaxis';
    const merchantPayeeName =
      settings?.merchantPayeeName || settings?.schoolName || 'Macro Vision Academy Burhanpur';
    const bankAccountSummary =
      settings?.bankAccountSummary || 'Axis Bank Burhanpur · A/C ••••4821 · IFSC UTIB0001482';

    const merchantTxnId = `MVA${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const upiLinks = buildUpiPaymentLinks({
      upiId: merchantUpiId,
      payeeName: merchantPayeeName,
      amountInr: fee.amount,
      txnRef: merchantTxnId,
      note: `${stu.studentCode} ${fee.title}`,
    });

    const qrDataUrl = await QRCode.toDataURL(upiLinks.upiUri, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    let gatewayProvider: 'RAZORPAY' | 'UPI_INTENT' = 'UPI_INTENT';
    let gatewayOrderId: string | null = null;
    let razorpayKeyId: string | undefined;

    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        const auth = Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
        ).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: fee.amount * 100,
            currency: 'INR',
            receipt: merchantTxnId,
            notes: {
              studentCode: stu.studentCode,
              feeRecordId: String(fee.id),
              paymentMethod: parsed.data.paymentMethod,
            },
          }),
        });
        if (rzpRes.ok) {
          const order = (await rzpRes.json()) as { id?: string };
          if (order?.id) {
            gatewayProvider = 'RAZORPAY';
            gatewayOrderId = order.id;
            razorpayKeyId = process.env.RAZORPAY_KEY_ID;
          }
        }
      } catch (rzpErr) {
        console.warn('Razorpay order creation unavailable, using verified UPI Intent flow:', rzpErr);
      }
    }

    const [createdPayment] = await db
      .insert(feePayments)
      .values({
        feeRecordId: fee.id,
        studentId,
        parentUserId: user.id,
        merchantTxnId,
        gatewayProvider,
        gatewayOrderId,
        paymentMethod: parsed.data.paymentMethod,
        amount: fee.amount,
        currency: 'INR',
        payerName: parsed.data.payerName.trim(),
        payerPhone: normalizedPhone,
        payerEmail: parsed.data.payerEmail?.trim() || null,
        payerUpiId: parsed.data.payerUpiId?.trim() || null,
        status: 'INITIATED',
        upiUri: upiLinks.upiUri,
      })
      .returning();

    const integrityToken = signPaymentIntentToken(
      {
        paymentId: createdPayment.id,
        feeRecordId: fee.id,
        studentId,
        userId: user.id,
        amount: fee.amount,
        merchantTxnId,
      },
      30
    );

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    return res.status(201).json({
      paymentId: createdPayment.id,
      merchantTxnId,
      integrityToken,
      gatewayProvider,
      razorpayKeyId,
      gatewayOrderId: gatewayOrderId || undefined,
      amount: fee.amount,
      currency: 'INR',
      paymentMethod: parsed.data.paymentMethod,
      merchantUpiId,
      merchantPayeeName,
      bankAccountSummary,
      upiLinks,
      qrDataUrl,
      expiresAt,
    });
  } catch (err) {
    console.error('Create payment intent error:', err);
    return res.status(500).json({ error: 'Unable to initiate fee payment session.' });
  }
});

const verifyPaymentSchema = z.object({
  paymentId: z.number().int().positive(),
  integrityToken: z.string().min(20),
  utrNumber: z.string().trim().max(40).optional().or(z.literal('')),
  payerUpiId: z.string().trim().max(100).optional().or(z.literal('')),
  cardLast4: z.string().trim().regex(/^\d{4}$/, 'Enter the last 4 digits of card only.').optional().or(z.literal('')),
  bankName: z.string().trim().max(60).optional().or(z.literal('')),
  razorpayOrderId: z.string().trim().max(100).optional(),
  razorpayPaymentId: z.string().trim().max(100).optional(),
  razorpaySignature: z.string().trim().max(200).optional(),
});

// Step 2: Cryptographically Verify Payment Order + UTR / Gateway Signature & Issue Official Receipt
router.post('/students/:studentId/fees/:feeId/payment-verify', requireAuth, async (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  const feeId = Number(req.params.feeId);
  if (!Number.isInteger(studentId) || !Number.isInteger(feeId) || studentId <= 0 || feeId <= 0) {
    return res.status(400).json({ error: 'Invalid student or fee identifier.' });
  }

  const user = req.authUser!;
  if (user.role !== 'PARENT' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only parents or administrators can verify fee payments.' });
  }

  const parsed = verifyPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payment verification payload.' });
  }

  const tokenPayload = verifyPaymentIntentToken(parsed.data.integrityToken);
  if (
    !tokenPayload ||
    tokenPayload.paymentId !== parsed.data.paymentId ||
    tokenPayload.feeRecordId !== feeId ||
    tokenPayload.studentId !== studentId ||
    tokenPayload.userId !== user.id
  ) {
    return res.status(400).json({
      error: 'Payment session expired or invalid. Please restart the fee checkout.',
    });
  }

  try {
    const allowed = await canAccessStudent(user, studentId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to verify fees for this student.' });
    }

    const [paymentRow] = await db
      .select()
      .from(feePayments)
      .where(
        and(
          eq(feePayments.id, parsed.data.paymentId),
          eq(feePayments.feeRecordId, feeId),
          eq(feePayments.studentId, studentId)
        )
      )
      .limit(1);

    if (!paymentRow) {
      return res.status(404).json({ error: 'Payment session not found.' });
    }
    if (paymentRow.status === 'SUCCESS') {
      return res.status(409).json({ error: 'This payment session has already been completed.' });
    }
    if (paymentRow.amount !== tokenPayload.amount) {
      return res.status(400).json({ error: 'Payment amount mismatch.' });
    }

    let verifiedRef = '';
    let verifiedPayerUpi = paymentRow.payerUpiId || null;
    const cardLast4 = parsed.data.cardLast4 || null;

    if (parsed.data.payerUpiId) {
      if (!isValidUpiVpa(parsed.data.payerUpiId)) {
        return res.status(400).json({ error: 'Invalid UPI ID format.' });
      }
      verifiedPayerUpi = parsed.data.payerUpiId.trim();
    }

    if (
      paymentRow.gatewayProvider === 'RAZORPAY' &&
      parsed.data.razorpayOrderId &&
      parsed.data.razorpayPaymentId &&
      parsed.data.razorpaySignature
    ) {
      const secret = process.env.RAZORPAY_KEY_SECRET || '';
      if (parsed.data.razorpayOrderId !== paymentRow.gatewayOrderId) {
        return res.status(400).json({ error: 'Gateway order mismatch.' });
      }
      const validSig = verifyRazorpaySignature({
        orderId: parsed.data.razorpayOrderId,
        paymentId: parsed.data.razorpayPaymentId,
        signature: parsed.data.razorpaySignature,
        secret,
      });
      if (!validSig) {
        return res.status(400).json({ error: 'Payment signature verification failed.' });
      }
      verifiedRef = parsed.data.razorpayPaymentId;
    } else {
      const rawRef = (parsed.data.utrNumber || '').trim().toUpperCase();
      if (!rawRef || !isValidTransactionRef(rawRef)) {
        return res.status(400).json({
          error:
            paymentRow.paymentMethod === 'CARD' || paymentRow.paymentMethod === 'NETBANKING'
              ? 'Please enter a valid 10–36 character Bank / Card Transaction Reference ID.'
              : 'Please enter the 12-digit UTR / UPI Reference Number from PhonePe, Google Pay, or Paytm.',
        });
      }
      if (paymentRow.paymentMethod === 'CARD' && !cardLast4) {
        return res.status(400).json({ error: 'Please enter the last 4 digits of your card for receipt verification.' });
      }
      verifiedRef = rawRef;

      // Prevent duplicate UTR / transaction ref reuse
      const [dupUtr] = await db
        .select({ id: feePayments.id })
        .from(feePayments)
        .where(eq(feePayments.utrNumber, verifiedRef))
        .limit(1);
      if (dupUtr) {
        return res.status(409).json({
          error: `Transaction Reference / UTR "${verifiedRef}" has already been recorded for another fee payment.`,
        });
      }
    }

    const paidDate = new Date().toISOString().slice(0, 10);
    const paidAt = new Date();
    const receiptNo = `SC-2026-${4000 + feeId}`;

    const result = await db.transaction(async (tx) => {
      const [updatedFee] = await tx
        .update(feeRecords)
        .set({
          status: 'PAID',
          paidDate,
          receiptNo,
          paymentMethod: paymentRow.paymentMethod,
          transactionRef: verifiedRef,
          payerName: paymentRow.payerName,
          payerPhone: paymentRow.payerPhone,
          payerEmail: paymentRow.payerEmail,
          payerUpiId: verifiedPayerUpi,
          paidByUserId: user.id,
        })
        .where(
          and(
            eq(feeRecords.id, feeId),
            eq(feeRecords.studentId, studentId),
            sql`${feeRecords.status} != 'PAID'`
          )
        )
        .returning();

      if (!updatedFee) {
        throw new Error('ALREADY_PAID');
      }

      await tx
        .update(feePayments)
        .set({
          status: 'SUCCESS',
          utrNumber: verifiedRef,
          gatewayPaymentId: parsed.data.razorpayPaymentId || verifiedRef,
          payerUpiId: verifiedPayerUpi,
          cardLast4,
          receiptNo,
          paidAt,
        })
        .where(eq(feePayments.id, paymentRow.id));

      return updatedFee;
    });

    const [stuInfo] = await db
      .select({
        studentCode: students.studentCode,
        fullName: students.fullName,
        userId: students.userId,
        className: classes.name,
        section: classes.section,
      })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(eq(students.id, studentId))
      .limit(1);

    const notifyUserIds = new Set<number>([user.id]);
    if (stuInfo?.userId) notifyUserIds.add(stuInfo.userId);

    await db.insert(notifications).values(
      Array.from(notifyUserIds).map((uid) => ({
        userId: uid,
        title: 'Fee Receipt Issued',
        message: `Online payment of ₹${result.amount.toLocaleString()} via ${paymentRow.paymentMethod.replace('_', ' ')} confirmed (Ref: ${verifiedRef}). Receipt ${receiptNo}.`,
        type: 'NOTICE',
        linkTab: 'fees',
      }))
    );

    await db.insert(auditLogs).values({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'ONLINE_FEE_PAYMENT',
      entityType: 'fee_records',
      entityId: String(feeId),
      details: `${user.fullName} completed ${paymentRow.paymentMethod} fee payment (${receiptNo}, Ref ${verifiedRef}) of ₹${result.amount} for ${stuInfo?.fullName || `Student #${studentId}`}.`,
    });

    return res.json({
      success: true,
      feeRecord: result,
      receipt: {
        receiptNo,
        transactionRef: verifiedRef,
        merchantTxnId: paymentRow.merchantTxnId,
        paymentMethod: paymentRow.paymentMethod,
        amount: result.amount,
        paidDate,
        paidAt: paidAt.toISOString(),
        payerName: paymentRow.payerName,
        payerPhone: paymentRow.payerPhone,
        payerEmail: paymentRow.payerEmail,
        payerUpiId: verifiedPayerUpi,
        studentName: stuInfo?.fullName || `Student #${studentId}`,
        studentCode: stuInfo?.studentCode || '',
        className: stuInfo?.className || '',
        section: stuInfo?.section || '',
        feeTitle: result.title,
        feeCategory: result.category,
      },
    });
  } catch (err: any) {
    if (err?.message === 'ALREADY_PAID') {
      return res.status(409).json({ error: 'This fee invoice has already been paid.' });
    }
    if (err?.code === '23505') {
      return res.status(409).json({
        error: 'This Transaction Reference / UTR has already been used for another payment.',
      });
    }
    console.error('Verify fee payment error:', err);
    return res.status(500).json({ error: 'Failed to verify fee payment.' });
  }
});

// Admin Office Desk Manual Fee Collection (Parents use /payment-intent + /payment-verify above)
router.post('/students/:studentId/fees/:feeId/pay', requireAuth, async (req: AuthRequest, res) => {
  const studentId = Number(req.params.studentId);
  const feeId = Number(req.params.feeId);
  if (!Number.isInteger(studentId) || !Number.isInteger(feeId)) {
    return res.status(400).json({ error: 'Invalid student or fee identifier.' });
  }
  const user = req.authUser!;
  if (user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Parents must complete fee payments via the online UPI / payment verification flow.',
    });
  }
  try {
    const allowed = await canAccessStudent(user, studentId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to pay fees for this student.' });
    }

    const [existing] = await db
      .select()
      .from(feeRecords)
      .where(and(eq(feeRecords.id, feeId), eq(feeRecords.studentId, studentId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'Fee invoice not found.' });
    if (existing.status === 'PAID') {
      return res.json(existing);
    }

    const paidDate = new Date().toISOString().slice(0, 10);
    const receiptNo = `SC-2026-${4000 + existing.id}`;
    const deskRef = `DESK-${existing.id}-${Date.now().toString(36).toUpperCase()}`;

    const [updated] = await db
      .update(feeRecords)
      .set({
        status: 'PAID',
        paidDate,
        receiptNo,
        paymentMethod: 'ADMIN_CASH',
        transactionRef: deskRef,
        payerName: 'School Office Counter',
        paidByUserId: user.id,
      })
      .where(eq(feeRecords.id, feeId))
      .returning();

    await db.insert(notifications).values({
      userId: user.id,
      title: 'Fee Receipt Issued',
      message: `Office payment of ₹${existing.amount.toLocaleString()} for "${existing.title}" confirmed. Receipt ${receiptNo}.`,
      type: 'NOTICE',
      linkTab: 'fees',
    });

    await db.insert(auditLogs).values({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'PAY_FEE',
      entityType: 'fee_records',
      entityId: String(feeId),
      details: `${user.fullName} recorded school desk payment (${receiptNo}) of ₹${existing.amount} for student #${studentId}.`,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Fee payment error:', err);
    return res.status(500).json({ error: 'Failed to process fee payment.' });
  }
});

// Campus Media & Gallery Updates
router.get('/gallery', requireAuth, async (req: AuthRequest, res) => {
  try {
    const album = req.query.album ? String(req.query.album).trim() : null;
    const rows = await db
      .select({
        id: galleryItems.id,
        title: galleryItems.title,
        description: galleryItems.description,
        albumName: galleryItems.albumName,
        eventDate: galleryItems.eventDate,
        imageUrl: galleryItems.imageUrl,
        postedByName: users.fullName,
        createdAt: galleryItems.createdAt,
      })
      .from(galleryItems)
      .innerJoin(users, eq(galleryItems.postedById, users.id))
      .orderBy(desc(galleryItems.eventDate), desc(galleryItems.createdAt));

    const filtered = album && album !== 'ALL' ? rows.filter((r) => r.albumName === album) : rows;
    return res.json(filtered);
  } catch (err) {
    console.error('Failed to load campus gallery:', err);
    return res.status(500).json({ error: 'Failed to load campus gallery.' });
  }
});

// Stream or download authorized student activity photo/video (supports HTTP Range for 1GB+ video playback)
router.get('/student-activities/:activityId/media', async (req, res) => {
  const activityId = Number(req.params.activityId);
  if (!Number.isInteger(activityId) || activityId <= 0) {
    return res.status(400).json({ error: 'Invalid activity identifier.' });
  }

  try {
    let resolvedUserId: number | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const session = verifySessionToken(authHeader.slice(7).trim());
      if (session) resolvedUserId = session.userId;
    }

    if (!resolvedUserId && typeof req.query.mt === 'string') {
      const mediaPayload = verifyMediaAccessToken(req.query.mt, activityId);
      if (mediaPayload) resolvedUserId = mediaPayload.userId;
    }

    if (!resolvedUserId) {
      return res.status(401).json({ error: 'Authentication required to access student activity media.' });
    }

    const [dbUser] = await db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, resolvedUserId))
      .limit(1);

    if (!dbUser || !dbUser.isActive) {
      return res.status(401).json({ error: 'Account inactive or not found.' });
    }

    const [activity] = await db
      .select()
      .from(studentActivities)
      .where(eq(studentActivities.id, activityId))
      .limit(1);

    if (!activity) {
      return res.status(404).json({ error: 'Activity media not found.' });
    }

    const allowed = await canAccessStudent(
      {
        id: dbUser.id,
        uid: dbUser.uid,
        email: dbUser.email,
        username: dbUser.username,
        fullName: dbUser.fullName,
        role: dbUser.role as UserRole,
        avatarUrl: dbUser.avatarUrl,
      },
      activity.studentId
    );
    if (!allowed) {
      return res.status(403).json({ error: 'You are not authorized to view this student activity media.' });
    }

    const safePath = resolveSafeUploadPath(ACTIVITY_UPLOADS_DIR, activity.storedFilename);
    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'Media file not found on server.' });
    }

    const stat = fs.statSync(safePath);
    const totalSize = stat.size;
    const isDownload = req.query.download === '1';

    res.setHeader('Content-Type', activity.mimeType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (isDownload) {
      const safeDownloadName = path.basename(activity.fileName).replace(/["\r\n]/g, '');
      res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName}"`);
    }

    const rangeHeader = req.headers.range;
    if (rangeHeader && !isDownload) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = Math.max(0, parseInt(parts[0], 10) || 0);
      const end = parts[1] ? Math.min(totalSize - 1, parseInt(parts[1], 10)) : totalSize - 1;
      if (start >= totalSize || end < start) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
        return res.end();
      }
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', String(chunkSize));
      const stream = fs.createReadStream(safePath, { start, end });
      return stream.pipe(res);
    }

    res.setHeader('Content-Length', String(totalSize));
    const stream = fs.createReadStream(safePath);
    return stream.pipe(res);
  } catch (err) {
    console.error('Stream student activity media error:', err);
    return res.status(500).json({ error: 'Unable to load student activity media.' });
  }
});

export default router;
