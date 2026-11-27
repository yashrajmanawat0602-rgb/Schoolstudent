import { Router } from 'express';
import { and, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  academicYears,
  assignments,
  attendance,
  auditLogs,
  classes,
  classSubjects,
  classTimetables,
  exams,
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
  students,
  subjects,
  teacherRemarks,
  users,
} from '../db/schema.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { hashPassword, isValidUpiVpa } from '../utils/security.ts';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

async function logAdminAudit(
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

// School-wide Admin Overview
router.get('/overview', async (_req, res) => {
  try {
    const [{ value: studentCount }] = await db.select({ value: count() }).from(students);
    const [{ value: teacherCount }] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.role, 'TEACHER'));
    const [{ value: parentCount }] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.role, 'PARENT'));
    const [{ value: classCount }] = await db.select({ value: count() }).from(classes);
    const [{ value: subjectCount }] = await db.select({ value: count() }).from(subjects);

    const [avgMarks] = await db
      .select({
        avgPct: sql<number>`ROUND(AVG(${marks.obtainedMarks}::numeric / NULLIF(${marks.maxMarks}, 0) * 100), 1)`,
      })
      .from(marks);

    const [attSummary] = await db
      .select({
        total: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} != 'HOLIDAY')`,
        present: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} IN ('PRESENT', 'LATE'))`,
      })
      .from(attendance);

    const attRate =
      Number(attSummary?.total) > 0
        ? Math.round((Number(attSummary.present) / Number(attSummary.total)) * 1000) / 10
        : 0;

    const classBreakdown = await db
      .select({
        classId: classes.id,
        className: classes.name,
        section: classes.section,
        roomNumber: classes.roomNumber,
        classTeacherId: classes.classTeacherId,
        classTeacherName: users.fullName,
        studentCount: sql<number>`COUNT(${students.id})`,
      })
      .from(classes)
      .leftJoin(users, eq(classes.classTeacherId, users.id))
      .leftJoin(students, eq(students.classId, classes.id))
      .groupBy(classes.id, classes.name, classes.section, classes.roomNumber, classes.classTeacherId, users.fullName)
      .orderBy(classes.name, classes.section);

    const recentLogs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(15);

    const [settings] = await db.select().from(schoolSettings).limit(1);

    return res.json({
      stats: {
        totalStudents: Number(studentCount),
        totalTeachers: Number(teacherCount),
        totalParents: Number(parentCount),
        totalClasses: Number(classCount),
        totalSubjects: Number(subjectCount),
        schoolAvgPct: Number(avgMarks?.avgPct || 0),
        schoolAttendancePct: attRate,
      },
      classBreakdown: classBreakdown.map((c) => ({
        ...c,
        studentCount: Number(c.studentCount),
      })),
      recentLogs,
      settings,
    });
  } catch (err) {
    console.error('Admin overview failed:', err);
    return res.status(500).json({ error: 'Failed to load admin overview.' });
  }
});

// Users management
router.get('/users', async (req, res) => {
  const roleFilter = req.query.role ? String(req.query.role) : null;
  try {
    const rows = roleFilter
      ? await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            fullName: users.fullName,
            role: users.role,
            phone: users.phone,
            isActive: users.isActive,
            lastLoginAt: users.lastLoginAt,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.role, roleFilter))
          .orderBy(users.fullName)
      : await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            fullName: users.fullName,
            role: users.role,
            phone: users.phone,
            isActive: users.isActive,
            lastLoginAt: users.lastLoginAt,
            createdAt: users.createdAt,
          })
          .from(users)
          .orderBy(users.role, users.fullName);

    return res.json(rows);
  } catch (err) {
    console.error('Failed to list users:', err);
    return res.status(500).json({ error: 'Failed to load user accounts.' });
  }
});

const createUserSchema = z.object({
  fullName: z.string().min(2).max(120),
  username: z.string().min(3).max(60).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(128),
  role: z.enum(['ADMIN', 'TEACHER', 'PARENT', 'STUDENT']),
  phone: z.string().max(30).optional(),
});

router.post('/users', async (req: AuthRequest, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid user data.' });
  }

  const role = parsed.data.role;
  const cleanUsername = parsed.data.username?.trim().toUpperCase() || null;

  if (role === 'ADMIN') {
    return res.status(403).json({
      error: 'Additional Administrator accounts cannot be created from this panel.',
    });
  }

  if (!cleanUsername || cleanUsername.includes('@')) {
    return res.status(400).json({
      error: 'Teachers, Parents, and Students must use a School ID / Username (e.g. TCH-021, PAR-101, STU-10A-021), not an email address.',
    });
  }

  try {
    if (cleanUsername) {
      const [dupUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`UPPER(${users.username}) = ${cleanUsername}`)
        .limit(1);
      if (dupUser) {
        return res.status(409).json({ error: `School ID "${cleanUsername}" is already assigned.` });
      }
    }

    const [created] = await db
      .insert(users)
      .values({
        username: cleanUsername,
        email: null,
        passwordHash: hashPassword(parsed.data.password),
        fullName: parsed.data.fullName.trim(),
        role,
        phone: parsed.data.phone?.trim() || null,
        isActive: true,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        phone: users.phone,
        isActive: users.isActive,
      });

    await logAdminAudit(
      req.authUser!,
      'CREATE_USER',
      'users',
      created.id,
      `${req.authUser!.fullName} created ${created.role} account for ${created.fullName} (${created.email || created.username}).`
    );

    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'An account with this email or School ID already exists.' });
    }
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Failed to create user account.' });
  }
});

router.patch('/users/:id/status', async (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);
  const isActive = Boolean(req.body.isActive);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }
  if (targetId === req.authUser!.id && !isActive) {
    return res.status(400).json({ error: 'You cannot disable your own active administrator account.' });
  }
  try {
    const [updated] = await db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, targetId))
      .returning({ id: users.id, fullName: users.fullName, isActive: users.isActive });

    if (!updated) return res.status(404).json({ error: 'User not found.' });

    await logAdminAudit(
      req.authUser!,
      isActive ? 'ENABLE_ACCOUNT' : 'DISABLE_ACCOUNT',
      'users',
      targetId,
      `${req.authUser!.fullName} ${isActive ? 'enabled' : 'disabled'} account for ${updated.fullName}.`
    );

    return res.json(updated);
  } catch (err) {
    console.error('Toggle user status error:', err);
    return res.status(500).json({ error: 'Failed to update account status.' });
  }
});

router.post('/users/:id/reset-password', async (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);
  const newPassword = String(req.body.newPassword || '');
  if (!Number.isInteger(targetId) || targetId <= 0 || newPassword.length < 8) {
    return res.status(400).json({ error: 'Valid user ID and password (min 8 chars) required.' });
  }
  try {
    const [targetUser] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });

    const [updated] = await db
      .update(users)
      .set({ passwordHash: hashPassword(newPassword) })
      .where(eq(users.id, targetId))
      .returning({ id: users.id, fullName: users.fullName });

    if (!updated) return res.status(404).json({ error: 'User not found.' });

    await logAdminAudit(
      req.authUser!,
      'RESET_PASSWORD',
      'users',
      targetId,
      `${req.authUser!.fullName} reset account credentials for ${updated.fullName}.`
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Reset password failed:', err);
    return res.status(500).json({ error: 'Failed to reset account password.' });
  }
});

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  username: z.string().trim().min(3).max(60).optional(),
  phone: z.string().max(30).optional().nullable().or(z.literal('')),
  role: z.enum(['TEACHER', 'PARENT', 'STUDENT']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(128).optional().or(z.literal('')),
});

router.patch('/users/:id', async (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid account data.' });
  }

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    if (existing.role === 'ADMIN') {
      return res.status(403).json({
        error: 'Administrator accounts cannot be modified from this directory.',
      });
    }

    const d = parsed.data;
    const cleanUsername =
      d.username !== undefined ? d.username.trim().toUpperCase() : undefined;

    if (cleanUsername !== undefined) {
      if (!cleanUsername || cleanUsername.includes('@')) {
        return res.status(400).json({
          error: 'School ID / Username must be a School ID code (e.g. TCH-021), not an email address.',
        });
      }
      const [dupUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(sql`UPPER(${users.username}) = ${cleanUsername}`, ne(users.id, targetId)))
        .limit(1);
      if (dupUser) {
        return res.status(409).json({ error: `School ID "${cleanUsername}" is already assigned to another account.` });
      }
    }

    const updated = await db.transaction(async (tx) => {
      if (d.role && existing.role === 'TEACHER' && d.role !== 'TEACHER') {
        await tx
          .update(classes)
          .set({ classTeacherId: null })
          .where(eq(classes.classTeacherId, targetId));
        await tx.delete(classSubjects).where(eq(classSubjects.teacherId, targetId));
        await tx.delete(classTimetables).where(eq(classTimetables.teacherId, targetId));
      }

      const [row] = await tx
        .update(users)
        .set({
          ...(d.fullName !== undefined ? { fullName: d.fullName.trim() } : {}),
          ...(cleanUsername !== undefined ? { username: cleanUsername } : {}),
          ...(d.phone !== undefined ? { phone: cleanOpt(d.phone) } : {}),
          ...(d.role !== undefined ? { role: d.role } : {}),
          ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
          ...(d.password && d.password.length >= 8 ? { passwordHash: hashPassword(d.password) } : {}),
        })
        .where(eq(users.id, targetId))
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          fullName: users.fullName,
          role: users.role,
          phone: users.phone,
          isActive: users.isActive,
        });

      if (d.fullName !== undefined && (d.role || existing.role) === 'STUDENT') {
        await tx
          .update(students)
          .set({ fullName: d.fullName.trim() })
          .where(eq(students.userId, targetId));
      }

      return row;
    });

    await logAdminAudit(
      req.authUser!,
      'UPDATE_USER',
      'users',
      targetId,
      `${req.authUser!.fullName} updated ${updated.role} account for ${updated.fullName} (${updated.username || updated.email || targetId}).`
    );

    return res.json(updated);
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'An account with this School ID already exists.' });
    }
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'Failed to update user account.' });
  }
});

router.delete('/users/:id', async (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }
  if (targetId === req.authUser!.id) {
    return res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
  }

  try {
    const [existing] = await db
      .select({ id: users.id, fullName: users.fullName, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    if (existing.role === 'ADMIN') {
      return res.status(403).json({
        error: 'Administrator accounts cannot be deleted from this panel.',
      });
    }

    const adminActorId = req.authUser!.id;

    await db.transaction(async (tx) => {
      await tx.update(classes).set({ classTeacherId: null }).where(eq(classes.classTeacherId, targetId));
      await tx.update(students).set({ userId: null }).where(eq(students.userId, targetId));
      await tx.delete(classSubjects).where(eq(classSubjects.teacherId, targetId));
      await tx.delete(classTimetables).where(eq(classTimetables.teacherId, targetId));

      await tx.update(marks).set({ uploadedById: adminActorId }).where(eq(marks.uploadedById, targetId));
      await tx.update(attendance).set({ recordedById: adminActorId }).where(eq(attendance.recordedById, targetId));
      await tx.update(homework).set({ teacherId: adminActorId }).where(eq(homework.teacherId, targetId));
      await tx.update(assignments).set({ teacherId: adminActorId }).where(eq(assignments.teacherId, targetId));
      await tx.update(notes).set({ teacherId: adminActorId }).where(eq(notes.teacherId, targetId));
      await tx.update(teacherRemarks).set({ teacherId: adminActorId }).where(eq(teacherRemarks.teacherId, targetId));
      await tx.update(notices).set({ authorId: adminActorId }).where(eq(notices.authorId, targetId));
      await tx.update(galleryItems).set({ postedById: adminActorId }).where(eq(galleryItems.postedById, targetId));

      await tx.update(exams).set({ createdById: null }).where(eq(exams.createdById, targetId));
      await tx.update(schoolEvents).set({ createdById: null }).where(eq(schoolEvents.createdById, targetId));
      await tx.update(auditLogs).set({ actorId: null }).where(eq(auditLogs.actorId, targetId));

      await tx.delete(users).where(eq(users.id, targetId));
    });

    await logAdminAudit(
      req.authUser!,
      'DELETE_USER',
      'users',
      targetId,
      `${req.authUser!.fullName} deleted ${existing.role} account ${existing.fullName} (${existing.username || targetId}).`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete user failed:', err);
    return res.status(500).json({ error: 'Failed to delete user account.' });
  }
});

// Classes, Subjects, Academic Years
router.get('/classes', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: classes.id,
        name: classes.name,
        section: classes.section,
        roomNumber: classes.roomNumber,
        academicYearId: classes.academicYearId,
        classTeacherId: classes.classTeacherId,
        classTeacherName: users.fullName,
      })
      .from(classes)
      .leftJoin(users, eq(classes.classTeacherId, users.id))
      .orderBy(classes.name, classes.section);

    const assignmentsRows = await db
      .select({
        id: classSubjects.id,
        classId: classSubjects.classId,
        subjectId: classSubjects.subjectId,
        subjectName: subjects.name,
        teacherId: classSubjects.teacherId,
        teacherName: users.fullName,
      })
      .from(classSubjects)
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .innerJoin(users, eq(classSubjects.teacherId, users.id));

    return res.json({ classes: rows, assignments: assignmentsRows });
  } catch (err) {
    console.error('Load classes failed:', err);
    return res.status(500).json({ error: 'Failed to load classes.' });
  }
});

router.post('/classes', async (req: AuthRequest, res) => {
  const name = String(req.body.name || '').trim();
  const section = String(req.body.section || '').trim().toUpperCase();
  const roomNumber = String(req.body.roomNumber || '101').trim();
  const classTeacherId = req.body.classTeacherId ? Number(req.body.classTeacherId) : null;

  if (!name || !section) {
    return res.status(400).json({ error: 'Class name and section are required.' });
  }
  try {
    if (classTeacherId) {
      const [teacher] = await db
        .select({ id: users.id, fullName: users.fullName, role: users.role })
        .from(users)
        .where(eq(users.id, classTeacherId))
        .limit(1);
      if (!teacher || teacher.role !== 'TEACHER') {
        return res.status(400).json({ error: 'Selected user is not an active teacher.' });
      }
      const [alreadyAssigned] = await db
        .select({ id: classes.id, name: classes.name, section: classes.section })
        .from(classes)
        .where(eq(classes.classTeacherId, classTeacherId))
        .limit(1);
      if (alreadyAssigned) {
        return res.status(409).json({
          error: `${teacher.fullName} is already assigned as Class Teacher for ${alreadyAssigned.name}-${alreadyAssigned.section}. Each teacher manages one homeroom class.`,
        });
      }
    }

    const [currentYear] = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.isCurrent, true))
      .limit(1);

    const [created] = await db
      .insert(classes)
      .values({
        name,
        section,
        roomNumber,
        classTeacherId,
        academicYearId: currentYear?.id || 1,
      })
      .returning();

    await logAdminAudit(
      req.authUser!,
      'CREATE_CLASS',
      'classes',
      created.id,
      `${req.authUser!.fullName} created ${created.name}-${created.section}${classTeacherId ? ` with class teacher #${classTeacherId}` : ''}.`
    );
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: `Class ${name}-${section} already exists for the current academic year.` });
    }
    console.error('Create class error:', err);
    return res.status(500).json({ error: 'Failed to create class.' });
  }
});

router.patch('/classes/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid class ID.' });
  }
  const hasNameField = Object.prototype.hasOwnProperty.call(req.body, 'name');
  const hasSectionField = Object.prototype.hasOwnProperty.call(req.body, 'section');
  const hasTeacherField = Object.prototype.hasOwnProperty.call(req.body, 'classTeacherId');
  const name = hasNameField ? String(req.body.name || '').trim() : undefined;
  const section = hasSectionField ? String(req.body.section || '').trim().toUpperCase() : undefined;
  const classTeacherId =
    req.body.classTeacherId === null || req.body.classTeacherId === '' || req.body.classTeacherId === 0
      ? null
      : req.body.classTeacherId
        ? Number(req.body.classTeacherId)
        : undefined;
  const roomNumber =
    typeof req.body.roomNumber === 'string' && req.body.roomNumber.trim()
      ? req.body.roomNumber.trim()
      : undefined;

  if (hasNameField && !name) {
    return res.status(400).json({ error: 'Class name cannot be empty.' });
  }
  if (hasSectionField && !section) {
    return res.status(400).json({ error: 'Section cannot be empty.' });
  }

  try {
    const [existingClass] = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    let teacherName: string | null = null;
    if (hasTeacherField && classTeacherId) {
      const [teacher] = await db
        .select({ id: users.id, fullName: users.fullName, role: users.role })
        .from(users)
        .where(eq(users.id, classTeacherId))
        .limit(1);
      if (!teacher || teacher.role !== 'TEACHER') {
        return res.status(400).json({ error: 'Selected user is not a valid teacher.' });
      }
      teacherName = teacher.fullName;
      const [conflict] = await db
        .select({ id: classes.id, name: classes.name, section: classes.section })
        .from(classes)
        .where(and(eq(classes.classTeacherId, classTeacherId), ne(classes.id, id)))
        .limit(1);
      if (conflict) {
        return res.status(409).json({
          error: `${teacher.fullName} is already Class Teacher of ${conflict.name}-${conflict.section}. Unassign them there first or choose another teacher.`,
        });
      }
    }

    const [updated] = await db
      .update(classes)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(section !== undefined ? { section } : {}),
        ...(hasTeacherField ? { classTeacherId: classTeacherId ?? null } : {}),
        ...(roomNumber !== undefined ? { roomNumber } : {}),
      })
      .where(eq(classes.id, id))
      .returning();

    const changeParts: string[] = [];
    if (name !== undefined || section !== undefined || roomNumber !== undefined) {
      changeParts.push(`updated details for ${updated.name}-${updated.section} (Room ${updated.roomNumber || '101'})`);
    }
    if (hasTeacherField) {
      changeParts.push(
        teacherName
          ? `assigned ${teacherName} as Class Teacher of ${updated.name}-${updated.section}`
          : `unassigned Class Teacher from ${updated.name}-${updated.section}`
      );
    }

    await logAdminAudit(
      req.authUser!,
      hasNameField || hasSectionField ? 'UPDATE_CLASS' : 'ASSIGN_CLASS_TEACHER',
      'classes',
      updated.id,
      `${req.authUser!.fullName} ${changeParts.join(' and ') || `updated ${updated.name}-${updated.section}`}.`
    );

    return res.json(updated);
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: `Class ${name || ''}-${section || ''} already exists for the current academic year.` });
    }
    console.error('Update class failed:', err);
    return res.status(500).json({ error: 'Failed to update class.' });
  }
});

router.delete('/classes/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid class ID.' });
  }
  try {
    const [existingClass] = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    const [{ value: enrolledCount }] = await db
      .select({ value: count() })
      .from(students)
      .where(eq(students.classId, id));

    if (Number(enrolledCount) > 0) {
      return res.status(409).json({
        error: `Cannot delete ${existingClass.name}-${existingClass.section} while ${enrolledCount} student(s) are enrolled in it. Reassign or delete those students first.`,
      });
    }

    await db.transaction(async (tx) => {
      await tx.update(exams).set({ classId: null }).where(eq(exams.classId, id));
      await tx.update(notices).set({ targetClassId: null }).where(eq(notices.targetClassId, id));
      await tx.update(schoolEvents).set({ classId: null }).where(eq(schoolEvents.classId, id));
      await tx.delete(marks).where(eq(marks.classId, id));
      await tx.delete(attendance).where(eq(attendance.classId, id));
      await tx.delete(classes).where(eq(classes.id, id));
    });

    await logAdminAudit(
      req.authUser!,
      'DELETE_CLASS',
      'classes',
      id,
      `${req.authUser!.fullName} deleted class ${existingClass.name}-${existingClass.section}.`
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete class failed:', err);
    return res.status(500).json({ error: 'Failed to delete class.' });
  }
});

router.post('/class-subjects', async (req: AuthRequest, res) => {
  const classId = Number(req.body.classId);
  const subjectId = Number(req.body.subjectId);
  const teacherId = Number(req.body.teacherId);
  if (!classId || !subjectId || !teacherId) {
    return res.status(400).json({ error: 'Class, subject, and teacher are required.' });
  }
  try {
    const [currentYear] = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.isCurrent, true))
      .limit(1);

    const [saved] = await db
      .insert(classSubjects)
      .values({
        classId,
        subjectId,
        teacherId,
        academicYearId: currentYear?.id || 1,
      })
      .onConflictDoUpdate({
        target: [classSubjects.classId, classSubjects.subjectId, classSubjects.academicYearId],
        set: { teacherId },
      })
      .returning();

    await logAdminAudit(
      req.authUser!,
      'ASSIGN_TEACHER',
      'class_subjects',
      saved.id,
      `${req.authUser!.fullName} assigned teacher #${teacherId} to class #${classId}, subject #${subjectId}.`
    );
    return res.json(saved);
  } catch (err) {
    console.error('Assign teacher failed:', err);
    return res.status(500).json({ error: 'Failed to assign teacher.' });
  }
});

router.delete('/class-subjects/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid subject assignment ID.' });
  }
  try {
    const [deleted] = await db
      .delete(classSubjects)
      .where(eq(classSubjects.id, id))
      .returning();
    if (!deleted) {
      return res.status(404).json({ error: 'Subject teacher assignment not found.' });
    }
    await logAdminAudit(
      req.authUser!,
      'REMOVE_SUBJECT_TEACHER',
      'class_subjects',
      id,
      `${req.authUser!.fullName} removed subject teacher assignment #${id}.`
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Remove subject assignment failed:', err);
    return res.status(500).json({ error: 'Failed to remove subject assignment.' });
  }
});

router.get('/subjects', async (_req, res) => {
  try {
    const rows = await db.select().from(subjects).orderBy(subjects.name);
    return res.json(rows);
  } catch (err) {
    console.error('Load subjects error:', err);
    return res.status(500).json({ error: 'Failed to load subjects.' });
  }
});

router.post('/subjects', async (req: AuthRequest, res) => {
  const name = String(req.body.name || '').trim();
  const code = String(req.body.code || '').trim().toUpperCase();
  const department = String(req.body.department || 'General').trim();
  if (!name || !code) {
    return res.status(400).json({ error: 'Subject name and code are required.' });
  }
  try {
    const [created] = await db
      .insert(subjects)
      .values({ name, code, department })
      .returning();
    await logAdminAudit(
      req.authUser!,
      'CREATE_SUBJECT',
      'subjects',
      created.id,
      `${req.authUser!.fullName} created subject ${created.name} (${created.code}).`
    );
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Subject name or code already exists.' });
    }
    return res.status(500).json({ error: 'Failed to create subject.' });
  }
});

router.patch('/subjects/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid subject ID.' });
  }
  const name = String(req.body.name || '').trim();
  const code = String(req.body.code || '').trim().toUpperCase();
  const department = String(req.body.department || 'General').trim();
  if (!name || !code) {
    return res.status(400).json({ error: 'Subject name and code are required.' });
  }
  try {
    const [updated] = await db
      .update(subjects)
      .set({ name, code, department: department || 'General' })
      .where(eq(subjects.id, id))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: 'Subject not found.' });
    }
    await logAdminAudit(
      req.authUser!,
      'UPDATE_SUBJECT',
      'subjects',
      updated.id,
      `${req.authUser!.fullName} updated subject ${updated.name} (${updated.code}).`
    );
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Another subject already uses that name or code.' });
    }
    console.error('Update subject failed:', err);
    return res.status(500).json({ error: 'Failed to update subject.' });
  }
});

router.delete('/subjects/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid subject ID.' });
  }
  try {
    const [existing] = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    const [
      [{ value: marksCount }],
      [{ value: hwCount }],
      [{ value: assignCount }],
      [{ value: notesCount }],
      [{ value: ttCount }],
    ] = await Promise.all([
      db.select({ value: count() }).from(marks).where(eq(marks.subjectId, id)),
      db.select({ value: count() }).from(homework).where(eq(homework.subjectId, id)),
      db.select({ value: count() }).from(assignments).where(eq(assignments.subjectId, id)),
      db.select({ value: count() }).from(notes).where(eq(notes.subjectId, id)),
      db.select({ value: count() }).from(classTimetables).where(eq(classTimetables.subjectId, id)),
    ]);

    if (
      Number(marksCount) > 0 ||
      Number(hwCount) > 0 ||
      Number(assignCount) > 0 ||
      Number(notesCount) > 0 ||
      Number(ttCount) > 0
    ) {
      return res.status(409).json({
        error: `Cannot delete ${existing.name} because marks, homework, assignments, notes, or timetable entries reference it.`,
      });
    }

    await db.transaction(async (tx) => {
      await tx.update(attendance).set({ subjectId: null }).where(eq(attendance.subjectId, id));
      await tx.update(teacherRemarks).set({ subjectId: null }).where(eq(teacherRemarks.subjectId, id));
      await tx.update(exams).set({ subjectId: null }).where(eq(exams.subjectId, id));
      await tx.delete(subjects).where(eq(subjects.id, id));
    });

    await logAdminAudit(
      req.authUser!,
      'DELETE_SUBJECT',
      'subjects',
      id,
      `${req.authUser!.fullName} deleted subject ${existing.name} (${existing.code}).`
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete subject failed:', err);
    return res.status(500).json({ error: 'Failed to delete subject.' });
  }
});

router.get('/academic-years', async (_req, res) => {
  const rows = await db.select().from(academicYears).orderBy(desc(academicYears.name));
  return res.json(rows);
});

router.post('/academic-years', async (req: AuthRequest, res) => {
  const name = String(req.body.name || '').trim();
  const startDate = String(req.body.startDate || '').trim();
  const endDate = String(req.body.endDate || '').trim();
  const isCurrent = Boolean(req.body.isCurrent);
  if (!name || !startDate || !endDate) {
    return res.status(400).json({ error: 'Academic year name, start date, and end date are required.' });
  }
  try {
    if (isCurrent) {
      await db.update(academicYears).set({ isCurrent: false });
    }
    const [created] = await db
      .insert(academicYears)
      .values({ name, startDate, endDate, isCurrent })
      .returning();
    await logAdminAudit(
      req.authUser!,
      'CREATE_ACADEMIC_YEAR',
      'academic_years',
      created.id,
      `${req.authUser!.fullName} created academic year ${created.name}.`
    );
    return res.status(201).json(created);
  } catch (err) {
    console.error('Create academic year failed:', err);
    return res.status(500).json({ error: 'Failed to create academic year.' });
  }
});

// Parent-Student Linking & Students Roster
const optionalDetailText = (maxLen = 200) =>
  z.string().max(maxLen).optional().nullable().or(z.literal(''));

router.get('/students', async (_req, res) => {
  try {
    const stuRows = await db
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
      .orderBy(classes.name, classes.section, students.rollNumber);

    const links = await db
      .select({
        id: parentStudentLinks.id,
        studentId: parentStudentLinks.studentId,
        studentName: students.fullName,
        studentCode: students.studentCode,
        className: classes.name,
        section: classes.section,
        parentId: parentStudentLinks.parentId,
        parentName: users.fullName,
        parentUsername: users.username,
        parentPhone: users.phone,
        parentEmail: users.email,
        relationship: parentStudentLinks.relationship,
      })
      .from(parentStudentLinks)
      .innerJoin(users, eq(parentStudentLinks.parentId, users.id))
      .innerJoin(students, eq(parentStudentLinks.studentId, students.id))
      .innerJoin(classes, eq(students.classId, classes.id));

    return res.json({
      students: stuRows.map(({ userId, ...rest }) => ({
        ...rest,
        hasPortalAccount: Boolean(userId),
      })),
      parentLinks: links,
    });
  } catch (err) {
    console.error('Failed to list admin students:', err);
    return res.status(500).json({ error: 'Failed to load students.' });
  }
});

const enrollStudentSchema = z.object({
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

const cleanOpt = (val?: string | null) => {
  const trimmed = (val ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

router.post('/students', async (req: AuthRequest, res) => {
  const parsed = enrollStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid student enrollment data.' });
  }
  const cleanCode = parsed.data.studentCode.trim().toUpperCase();
  if (cleanCode.includes('@')) {
    return res.status(400).json({ error: 'Student ID must be a School ID code (e.g. STU-10A-001), not an email address.' });
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

    await logAdminAudit(
      req.authUser!,
      'ENROLL_STUDENT',
      'students',
      created.id,
      `${req.authUser!.fullName} enrolled student ${created.fullName} (${created.studentCode}).`
    );

    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: `Student ID "${cleanCode}" already exists.` });
    }
    console.error('Enroll student error:', err);
    return res.status(500).json({ error: 'Failed to enroll student.' });
  }
});

const updateStudentSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  classId: z.number().int().positive().optional(),
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
  isActive: z.boolean().optional(),
  portalPassword: z.string().min(8).max(128).optional().or(z.literal('')),
});

router.patch('/students/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid student ID.' });
  }
  const parsed = updateStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid student details.' });
  }

  try {
    const [existing] = await db.select().from(students).where(eq(students.id, id)).limit(1);
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
        ...(d.classId !== undefined ? { classId: d.classId } : {}),
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
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      })
      .where(eq(students.id, id))
      .returning();

    await logAdminAudit(
      req.authUser!,
      'UPDATE_STUDENT_DETAILS',
      'students',
      updated.id,
      `${req.authUser!.fullName} updated student profile for ${updated.fullName} (${updated.studentCode}).`
    );

    return res.json(updated);
  } catch (err) {
    console.error('Update student details error:', err);
    return res.status(500).json({ error: 'Failed to update student details.' });
  }
});

router.delete('/students/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid student ID.' });
  }
  try {
    const [existing] = await db.select().from(students).where(eq(students.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    await db.transaction(async (tx) => {
      await tx.update(messages).set({ studentId: null }).where(eq(messages.studentId, id));
      await tx.delete(students).where(eq(students.id, id));

      if (existing.userId) {
        const [stuUser] = await tx
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, existing.userId))
          .limit(1);
        if (stuUser && stuUser.role === 'STUDENT') {
          await tx.update(auditLogs).set({ actorId: null }).where(eq(auditLogs.actorId, stuUser.id));
          await tx.delete(users).where(eq(users.id, stuUser.id));
        }
      }
    });

    await logAdminAudit(
      req.authUser!,
      'DELETE_STUDENT',
      'students',
      id,
      `${req.authUser!.fullName} removed student ${existing.fullName} (${existing.studentCode}).`
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete student failed:', err);
    return res.status(500).json({ error: 'Failed to delete student.' });
  }
});

// Systematic Parent Enrollment (Creates Parent School ID account + optionally links child/children)
const enrollParentSchema = z.object({
  fullName: z.string().min(2).max(120),
  username: z.string().min(3).max(60),
  password: z.string().min(8).max(128),
  phone: z.string().max(30).optional().or(z.literal('')),
  studentIds: z.array(z.number().int().positive()).optional(),
  relationship: z.string().max(40).optional(),
});

router.post('/parents', async (req: AuthRequest, res) => {
  const parsed = enrollParentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid parent enrollment data.' });
  }

  const cleanUsername = parsed.data.username.trim().toUpperCase();
  if (cleanUsername.includes('@')) {
    return res.status(400).json({ error: 'Parent School ID must be a School ID code (e.g. PAR-101), not an email address.' });
  }

  try {
    const [dupUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`UPPER(${users.username}) = ${cleanUsername}`)
      .limit(1);
    if (dupUser) {
      return res.status(409).json({ error: `School ID "${cleanUsername}" is already assigned.` });
    }

    const [createdParent] = await db
      .insert(users)
      .values({
        username: cleanUsername,
        email: null,
        passwordHash: hashPassword(parsed.data.password),
        fullName: parsed.data.fullName.trim(),
        role: 'PARENT',
        phone: cleanOpt(parsed.data.phone),
        isActive: true,
      })
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        phone: users.phone,
        isActive: users.isActive,
      });

    const studentIds = parsed.data.studentIds || [];
    const relationship = (parsed.data.relationship || 'Parent').trim() || 'Parent';
    if (studentIds.length > 0) {
      const validStudents = await db
        .select({ id: students.id })
        .from(students)
        .where(inArray(students.id, studentIds));
      if (validStudents.length > 0) {
        await db
          .insert(parentStudentLinks)
          .values(
            validStudents.map((s) => ({
              parentId: createdParent.id,
              studentId: s.id,
              relationship,
              isPrimary: true,
            }))
          )
          .onConflictDoNothing();
      }
    }

    await logAdminAudit(
      req.authUser!,
      'ENROLL_PARENT',
      'users',
      createdParent.id,
      `${req.authUser!.fullName} enrolled parent ${createdParent.fullName} (${createdParent.username})${studentIds.length > 0 ? ` and linked ${studentIds.length} student(s)` : ''}.`
    );

    return res.status(201).json(createdParent);
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Parent School ID already exists.' });
    }
    console.error('Enroll parent error:', err);
    return res.status(500).json({ error: 'Failed to enroll parent.' });
  }
});

router.post('/parent-links', async (req: AuthRequest, res) => {
  const parentId = Number(req.body.parentId);
  const studentId = Number(req.body.studentId);
  const relationship = String(req.body.relationship || 'Parent').trim();
  if (!parentId || !studentId) {
    return res.status(400).json({ error: 'Parent and student are required.' });
  }
  try {
    const [created] = await db
      .insert(parentStudentLinks)
      .values({ parentId, studentId, relationship, isPrimary: true })
      .onConflictDoNothing()
      .returning();

    await logAdminAudit(
      req.authUser!,
      'LINK_PARENT_STUDENT',
      'parent_student_links',
      created?.id || `${parentId}-${studentId}`,
      `${req.authUser!.fullName} connected parent #${parentId} to student #${studentId}.`
    );
    return res.status(201).json(created || { parentId, studentId, relationship });
  } catch (err) {
    console.error('Link parent-student error:', err);
    return res.status(500).json({ error: 'Failed to connect parent and student.' });
  }
});

router.delete('/parent-links/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid link ID.' });
  }
  try {
    await db.delete(parentStudentLinks).where(eq(parentStudentLinks.id, id));
    await logAdminAudit(
      req.authUser!,
      'UNLINK_PARENT_STUDENT',
      'parent_student_links',
      id,
      `${req.authUser!.fullName} removed parent-student link #${id}.`
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Unlink parent-student error:', err);
    return res.status(500).json({ error: 'Failed to unlink parent and student.' });
  }
});

// Audit Logs
router.get('/audit-logs', async (_req, res) => {
  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);
  return res.json(rows);
});

// School Branding & Settings
const settingsSchema = z.object({
  schoolName: z.string().min(2).max(120),
  tagline: z.string().min(2).max(200),
  logoUrl: z.string().max(400),
  address: z.string().max(300),
  email: z.string().email(),
  phone: z.string().max(40),
  website: z.string().max(200),
  currentAcademicYear: z.string().max(30),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  merchantUpiId: z
    .string()
    .trim()
    .refine((val) => !val || isValidUpiVpa(val), 'Invalid Merchant UPI ID (example: school@okaxis).')
    .optional(),
  merchantPayeeName: z.string().trim().min(2).max(120).optional(),
  bankAccountSummary: z.string().trim().max(200).optional(),
});

router.patch('/settings', async (req: AuthRequest, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid branding configuration.' });
  }
  try {
    const [existing] = await db.select().from(schoolSettings).limit(1);
    const [updated] = existing
      ? await db
          .update(schoolSettings)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(schoolSettings.id, existing.id))
          .returning()
      : await db.insert(schoolSettings).values(parsed.data).returning();

    await logAdminAudit(
      req.authUser!,
      'UPDATE_SCHOOL_SETTINGS',
      'school_settings',
      updated.id,
      `${req.authUser!.fullName} updated school branding & theme settings.`
    );
    return res.json(updated);
  } catch (err) {
    console.error('Update school settings failed:', err);
    return res.status(500).json({ error: 'Failed to update school settings.' });
  }
});

// Notices Pin / Delete
router.patch('/notices/:id/pin', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const isPinned = Boolean(req.body.isPinned);
  const [updated] = await db
    .update(notices)
    .set({ isPinned })
    .where(eq(notices.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: 'Notice not found.' });
  await logAdminAudit(
    req.authUser!,
    isPinned ? 'PIN_NOTICE' : 'UNPIN_NOTICE',
    'notices',
    id,
    `${req.authUser!.fullName} ${isPinned ? 'pinned' : 'unpinned'} notice "${updated.title}".`
  );
  return res.json(updated);
});

router.delete('/notices/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(notices).where(eq(notices.id, id));
  await logAdminAudit(
    req.authUser!,
    'DELETE_NOTICE',
    'notices',
    id,
    `${req.authUser!.fullName} removed notice #${id}.`
  );
  return res.json({ success: true });
});

// Create Calendar Event
router.post('/events', async (req: AuthRequest, res) => {
  const title = String(req.body.title || '').trim();
  const eventType = String(req.body.eventType || 'EVENT').trim();
  const eventDate = String(req.body.eventDate || '').trim();
  const startTime = String(req.body.startTime || '').trim();
  const location = String(req.body.location || '').trim();
  const description = String(req.body.description || '').trim();

  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return res.status(400).json({ error: 'Title and valid date (YYYY-MM-DD) are required.' });
  }
  const [created] = await db
    .insert(schoolEvents)
    .values({
      title,
      eventType,
      eventDate,
      startTime: startTime || null,
      location: location || null,
      description: description || null,
      createdById: req.authUser!.id,
    })
    .returning();

  await logAdminAudit(
    req.authUser!,
    'CREATE_EVENT',
    'school_events',
    created.id,
    `${req.authUser!.fullName} added school calendar event "${created.title}".`
  );
  return res.status(201).json(created);
});

// Manage Class Timetable Slots
const timetableSlotSchema = z.object({
  classId: z.number().int().positive(),
  dayOfWeek: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']),
  periodNumber: z.number().int().min(1).max(8),
  startTime: z.string().min(3).max(20),
  endTime: z.string().min(3).max(20),
  subjectId: z.number().int().positive(),
  teacherId: z.number().int().positive(),
  room: z.string().max(40).default('Room 201'),
});

router.post('/timetable', async (req: AuthRequest, res) => {
  const parsed = timetableSlotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid timetable entry.' });
  }
  try {
    const [created] = await db
      .insert(classTimetables)
      .values(parsed.data)
      .returning();

    await logAdminAudit(
      req.authUser!,
      'ADD_TIMETABLE_SLOT',
      'class_timetables',
      created.id,
      `${req.authUser!.fullName} added ${parsed.data.dayOfWeek} Period #${parsed.data.periodNumber} for class #${parsed.data.classId}.`
    );
    return res.status(201).json(created);
  } catch (err) {
    console.error('Add timetable error:', err);
    return res.status(500).json({ error: 'Failed to save timetable slot.' });
  }
});

// Admin Fee Management (Inspect all & issue fee invoices)
router.get('/fees', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: feeRecords.id,
        studentId: feeRecords.studentId,
        studentCode: students.studentCode,
        studentName: students.fullName,
        className: classes.name,
        section: classes.section,
        title: feeRecords.title,
        category: feeRecords.category,
        amount: feeRecords.amount,
        dueDate: feeRecords.dueDate,
        paidDate: feeRecords.paidDate,
        status: feeRecords.status,
        receiptNo: feeRecords.receiptNo,
        paymentMethod: feeRecords.paymentMethod,
        transactionRef: feeRecords.transactionRef,
        payerName: feeRecords.payerName,
        payerPhone: feeRecords.payerPhone,
      })
      .from(feeRecords)
      .innerJoin(students, eq(feeRecords.studentId, students.id))
      .innerJoin(classes, eq(students.classId, classes.id))
      .orderBy(desc(feeRecords.createdAt))
      .limit(1000);

    return res.json(rows);
  } catch (err) {
    console.error('Admin fees load error:', err);
    return res.status(500).json({ error: 'Failed to load fee ledger.' });
  }
});

const feeInvoiceSchema = z.object({
  studentId: z.number().int().positive().optional(),
  classId: z.number().int().positive().optional(),
  title: z.string().min(3).max(140),
  category: z.enum(['TUITION', 'TRANSPORT', 'EXAM', 'LAB']).default('TUITION'),
  amount: z.number().int().min(100).max(500000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post('/fees', async (req: AuthRequest, res) => {
  const parsed = feeInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid fee invoice.' });
  }
  if (!parsed.data.studentId && !parsed.data.classId) {
    return res.status(400).json({ error: 'Select a student or class to issue fee invoice.' });
  }
  try {
    const [currentYear] = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.isCurrent, true))
      .limit(1);

    const targetStudents = parsed.data.studentId
      ? await db.select({ id: students.id }).from(students).where(eq(students.id, parsed.data.studentId))
      : await db.select({ id: students.id }).from(students).where(eq(students.classId, parsed.data.classId!));

    if (targetStudents.length === 0) {
      return res.status(404).json({ error: 'No matching students found for fee invoice.' });
    }

    const inserted = await db
      .insert(feeRecords)
      .values(
        targetStudents.map((s) => ({
          studentId: s.id,
          title: parsed.data.title.trim(),
          category: parsed.data.category,
          amount: parsed.data.amount,
          dueDate: parsed.data.dueDate,
          status: 'PENDING',
          academicYearId: currentYear?.id || 1,
        }))
      )
      .returning();

    // Notify linked parents
    const parentRows = await db
      .selectDistinct({ parentId: parentStudentLinks.parentId })
      .from(parentStudentLinks);
    if (parsed.data.studentId && parentRows.length > 0) {
      const stuLinks = await db
        .select({ parentId: parentStudentLinks.parentId })
        .from(parentStudentLinks)
        .where(eq(parentStudentLinks.studentId, parsed.data.studentId));
      if (stuLinks.length > 0) {
        await db.insert(notifications).values(
          stuLinks.map((l) => ({
            userId: l.parentId,
            title: 'New Fee Invoice Issued',
            message: `${parsed.data.title.trim()} (₹${parsed.data.amount.toLocaleString()}) due ${parsed.data.dueDate}.`,
            type: 'NOTICE',
            linkTab: 'fees',
          }))
        );
      }
    }

    await logAdminAudit(
      req.authUser!,
      'ISSUE_FEE_INVOICE',
      'fee_records',
      inserted[0]?.id || 'bulk',
      `${req.authUser!.fullName} issued "${parsed.data.title.trim()}" (₹${parsed.data.amount}) to ${inserted.length} student(s).`
    );

    return res.status(201).json({ count: inserted.length, records: inserted });
  } catch (err) {
    console.error('Issue fee invoice error:', err);
    return res.status(500).json({ error: 'Failed to issue fee invoice.' });
  }
});

export default router;
