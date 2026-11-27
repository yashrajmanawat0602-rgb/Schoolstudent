import { NextFunction, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  classes,
  classSubjects,
  parentStudentLinks,
  students,
  users,
} from '../db/schema.ts';
import { UserRole, verifySessionToken } from '../utils/security.ts';

export interface AuthenticatedUser {
  id: number;
  uid: string | null;
  username: string | null;
  email: string | null;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  try {
    const session = verifySessionToken(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!dbUser || !dbUser.isActive) {
      return res.status(403).json({ error: 'Account is disabled or unavailable.' });
    }

    req.authUser = {
      id: dbUser.id,
      uid: dbUser.uid,
      username: dbUser.username,
      email: dbUser.email,
      fullName: dbUser.fullName,
      role: dbUser.role as UserRole,
      avatarUrl: dbUser.avatarUrl,
    };
    return next();
  } catch (err) {
    console.error('Auth verification failed:', err);
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({
        error: `Access denied. This resource requires ${allowedRoles.join(' or ')} permissions.`,
      });
    }
    return next();
  };
};

export async function isTeacherClassTeacherOfClass(
  teacherId: number,
  classId: number
): Promise<boolean> {
  const [homeroom] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.classTeacherId, teacherId)))
    .limit(1);
  return Boolean(homeroom);
}

export async function getAssignedHomeroomClassIds(teacherId: number): Promise<number[]> {
  const homerooms = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.classTeacherId, teacherId));
  return homerooms.map((r) => r.id);
}

export async function canClassTeacherManageStudent(
  authUser: AuthenticatedUser,
  studentId: number
): Promise<boolean> {
  if (authUser.role === 'ADMIN') return true;
  if (authUser.role !== 'TEACHER') return false;

  const [stu] = await db
    .select({ classId: students.classId })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!stu) return false;
  return isTeacherClassTeacherOfClass(authUser.id, stu.classId);
}

export async function canAccessStudent(
  authUser: AuthenticatedUser,
  studentId: number
): Promise<boolean> {
  if (authUser.role === 'ADMIN') return true;

  if (authUser.role === 'PARENT') {
    const link = await db
      .select({ id: parentStudentLinks.id })
      .from(parentStudentLinks)
      .where(
        and(
          eq(parentStudentLinks.parentId, authUser.id),
          eq(parentStudentLinks.studentId, studentId)
        )
      )
      .limit(1);
    return link.length > 0;
  }

  if (authUser.role === 'STUDENT') {
    const stu = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.id, studentId), eq(students.userId, authUser.id)))
      .limit(1);
    return stu.length > 0;
  }

  if (authUser.role === 'TEACHER') {
    const [stu] = await db
      .select({ classId: students.classId })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    if (!stu) return false;
    return isTeacherClassTeacherOfClass(authUser.id, stu.classId);
  }

  return false;
}

export async function canTeacherAccessClass(
  teacherId: number,
  classId: number
): Promise<boolean> {
  const [homeroom] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.classTeacherId, teacherId)))
    .limit(1);
  if (homeroom) return true;

  const [assigned] = await db
    .select({ id: classSubjects.id })
    .from(classSubjects)
    .where(
      and(
        eq(classSubjects.classId, classId),
        eq(classSubjects.teacherId, teacherId)
      )
    )
    .limit(1);
  return Boolean(assigned);
}

export async function getTeacherClassIds(teacherId: number): Promise<number[]> {
  const homerooms = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.classTeacherId, teacherId));

  const subjectClasses = await db
    .select({ classId: classSubjects.classId })
    .from(classSubjects)
    .where(eq(classSubjects.teacherId, teacherId));

  const idSet = new Set<number>();
  for (const r of homerooms) idSet.add(r.id);
  for (const r of subjectClasses) idSet.add(r.classId);
  return Array.from(idSet);
}
