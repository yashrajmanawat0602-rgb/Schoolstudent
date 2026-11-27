import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  classes,
  classSubjects,
  parentStudentLinks,
  schoolSettings,
  students,
  subjects,
  users,
} from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  signSessionToken,
  UserRole,
  verifyPassword,
} from '../utils/security.ts';

const ADMIN_GOOGLE_EMAIL = 'yashrajmanawat0602@gmail.com';

const router = Router();

const loginSchema = z.object({
  identifier: z.string().min(2, 'Please enter your School ID or Admin Email.').max(160).optional(),
  email: z.string().max(160).optional(),
  username: z.string().max(160).optional(),
  password: z.string().min(1, 'Password is required.'),
  portalMode: z.enum(['SCHOOL', 'ADMIN']).optional(),
  rememberMe: z.boolean().optional(),
});

const forgotSchema = z.object({
  identifier: z.string().min(2, 'Please enter your School ID or Admin Email.').max(160),
});

async function buildSessionContext(user: {
  id: number;
  username: string | null;
  email: string | null;
  fullName: string;
  role: string;
  avatarUrl: string | null;
}) {
  const [settings] = await db.select().from(schoolSettings).limit(1);

  let children: Array<{
    id: number;
    studentCode: string;
    fullName: string;
    rollNumber: number;
    classId: number;
    className: string;
    section: string;
    relationship: string;
    avatarUrl: string | null;
  }> = [];

  let studentProfile: {
    id: number;
    studentCode: string;
    fullName: string;
    rollNumber: number;
    classId: number;
    className: string;
    section: string;
    avatarUrl: string | null;
  } | null = null;

  let teacherClasses: Array<{
    classId: number;
    className: string;
    section: string;
    subjectId: number;
    subjectName: string;
  }> = [];

  if (user.role === 'PARENT') {
    const linked = await db
      .select({
        id: students.id,
        studentCode: students.studentCode,
        fullName: students.fullName,
        rollNumber: students.rollNumber,
        classId: students.classId,
        className: classes.name,
        section: classes.section,
        relationship: parentStudentLinks.relationship,
        avatarUrl: students.avatarUrl,
      })
      .from(parentStudentLinks)
      .innerJoin(students, eq(parentStudentLinks.studentId, students.id))
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(eq(parentStudentLinks.parentId, user.id));
    children = linked;
  } else if (user.role === 'STUDENT') {
    const [stu] = await db
      .select({
        id: students.id,
        studentCode: students.studentCode,
        fullName: students.fullName,
        rollNumber: students.rollNumber,
        classId: students.classId,
        className: classes.name,
        section: classes.section,
        avatarUrl: students.avatarUrl,
      })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(eq(students.userId, user.id))
      .limit(1);
    studentProfile = stu || null;
  } else if (user.role === 'TEACHER') {
    const subjectAssignments = await db
      .select({
        classId: classes.id,
        className: classes.name,
        section: classes.section,
        subjectId: subjects.id,
        subjectName: subjects.name,
      })
      .from(classSubjects)
      .innerJoin(classes, eq(classSubjects.classId, classes.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(eq(classSubjects.teacherId, user.id));

    const homeroomClasses = await db
      .select({
        classId: classes.id,
        className: classes.name,
        section: classes.section,
      })
      .from(classes)
      .where(eq(classes.classTeacherId, user.id));

    const seenClassIds = new Set(subjectAssignments.map((s) => s.classId));
    teacherClasses = [
      ...subjectAssignments,
      ...homeroomClasses
        .filter((hc) => !seenClassIds.has(hc.classId))
        .map((hc) => ({
          ...hc,
          subjectId: 0,
          subjectName: 'Class Teacher',
        })),
    ];
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
    },
    children,
    studentProfile,
    teacherClasses,
    schoolSettings: settings || null,
  };
}

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid credentials.' });
  }

  const rawIdentifier = (
    parsed.data.identifier ||
    parsed.data.username ||
    parsed.data.email ||
    ''
  ).trim();

  if (!rawIdentifier) {
    return res.status(400).json({ error: 'Please enter your Username or School ID.' });
  }

  const isEmailInput = rawIdentifier.includes('@');
  if (isEmailInput) {
    return res.status(403).json({
      error: 'Email and Gmail login are disabled. Please sign in using your Username or School ID.',
    });
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`UPPER(${users.username}) = ${rawIdentifier.toUpperCase()}`)
      .limit(1);

    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return res.status(401).json({
        error: 'Invalid Username / School ID or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'This account has been disabled. Please contact your school administrator.',
      });
    }

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const ttlHours = parsed.data.rememberMe ? 72 : 24;
    const token = signSessionToken(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role as UserRole,
        authProvider: 'SCHOOL_ID',
      },
      ttlHours
    );

    const context = await buildSessionContext(user);
    return res.json({ token, ...context });
  } catch (err) {
    console.error('Login failed:', err);
    return res.status(500).json({ error: 'Unable to complete login right now.' });
  }
});

router.post('/google', async (req, res) => {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
  if (!idToken) {
    return res.status(400).json({ error: 'Firebase ID token is required for Google Sign-In.' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = (decoded.email || '').trim().toLowerCase();

    if (!email || !decoded.email_verified) {
      return res.status(403).json({
        error: 'Google Sign-In requires a verified email address.',
      });
    }

    // Match by Firebase UID first, then verified email
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.uid, decoded.uid))
      .limit(1);

    if (!user) {
      [user] = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.email}) = ${email}`)
        .limit(1);
    }

    // Bootstrapped school admin Google email binds cleanly to the Admin account
    if (!user && email === ADMIN_GOOGLE_EMAIL) {
      const [existingAdmin] = await db
        .select()
        .from(users)
        .where(eq(users.role, 'ADMIN'))
        .limit(1);

      if (existingAdmin) {
        const [updatedAdmin] = await db
          .update(users)
          .set({
            uid: decoded.uid,
            email,
            avatarUrl: decoded.picture || existingAdmin.avatarUrl,
            lastLoginAt: new Date(),
          })
          .where(eq(users.id, existingAdmin.id))
          .returning();
        user = updatedAdmin;
      } else {
        const [createdAdmin] = await db
          .insert(users)
          .values({
            uid: decoded.uid,
            username: 'Adminmva',
            email,
            fullName: decoded.name || 'School Administrator',
            role: 'ADMIN',
            avatarUrl: decoded.picture || null,
            isActive: true,
            lastLoginAt: new Date(),
          })
          .returning();
        user = createdAdmin;
      }
    }

    // Any other verified Google user gets a clean isolated PARENT account (zero linked students until Admin links)
    if (!user) {
      const [createdUser] = await db
        .insert(users)
        .values({
          uid: decoded.uid,
          email,
          fullName: decoded.name || email.split('@')[0] || 'Portal User',
          role: 'PARENT',
          avatarUrl: decoded.picture || null,
          isActive: true,
          lastLoginAt: new Date(),
        })
        .returning();
      user = createdUser;
    } else {
      if (!user.isActive) {
        return res.status(403).json({
          error: 'This account has been disabled. Please contact your school administrator.',
        });
      }
      const [updated] = await db
        .update(users)
        .set({
          uid: user.uid || decoded.uid,
          email: user.email || email,
          avatarUrl: user.avatarUrl || decoded.picture || null,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
      user = updated;
    }

    const token = signSessionToken(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role as UserRole,
        authProvider: 'GOOGLE',
      },
      24
    );

    const context = await buildSessionContext(user);
    return res.json({ token, ...context });
  } catch (err) {
    console.error('Firebase Google Sign-In verification failed:', err);
    return res.status(401).json({
      error: 'Unable to verify Google Sign-In token. Please try signing in again.',
    });
  }
});

router.post('/register', (_req, res) => {
  return res.status(403).json({
    error:
      'Self-registration via email is disabled. Please obtain your School ID and password from your School Administrator.',
  });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const context = await buildSessionContext(req.authUser!);
    return res.json(context);
  } catch (err) {
    console.error('Profile lookup failed:', err);
    return res.status(500).json({ error: 'Failed to load user profile.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const parsed = forgotSchema.safeParse({
    identifier: req.body?.identifier || req.body?.email || '',
  });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid School ID or email.' });
  }
  return res.json({
    message:
      'If an account matches that School ID or Admin Email, your school administrator has been notified to reset your credentials.',
  });
});

export default router;
