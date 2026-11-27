# SchoolConnect System Architecture

## Overview
SchoolConnect uses a unified TypeScript full-stack architecture served on port `3000`:
- **Client SPA (`src/`)**: React 19 + Tailwind CSS v4 + Recharts. Session Bearer tokens are stored exclusively in React/JS memory (`src/services/api.ts`) rather than `localStorage` or `sessionStorage`.
- **API Server (`server.ts`, `src/routes/`)**: Express.js server protected by `helmet`, `express-rate-limit`, `zod` schema validation, and server-side RBAC middleware (`src/middleware/auth.ts`).
- **Database Layer (`src/db/`)**: Drizzle ORM connected to Cloud SQL PostgreSQL via `pg.Pool` Object Method.

## Role-Based Access Control (RBAC) & Authentication Policy
1. **ADMIN**: Full management of users, classes, subjects, parent–student links, fee invoicing, class timetables, campus gallery, school branding, notices, and audit logs. **Administrator login is restricted exclusively to Google Sign-In with `yashrajmanawat0602@gmail.com`.**
2. **TEACHER**: Signs in exclusively with an issued School ID (`username`, e.g., `TCH-001`) and password. Scoped to assigned classes (`classes.classTeacherId` or `class_subjects.teacherId`). Can manage marks, attendance, homework, assignments, study notes, campus gallery photos, and student remarks for authorized classes only.
3. **PARENT**: Signs in exclusively with an issued School ID (`username`, e.g., `PAR-SHARMA`) and password. Scoped strictly via `parent_student_links`. A parent can only read data, download receipts/report cards, and pay fees for children explicitly linked to their `user.id`.
4. **STUDENT**: Signs in exclusively with an issued School ID (`username`, e.g., `STU-10A-001`) and password. Scoped strictly via `students.userId = authUser.id`. Can only read their own marks, attendance, class timetable, fee ledger, remarks, campus gallery, and class materials.

