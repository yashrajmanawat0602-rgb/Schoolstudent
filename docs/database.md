# SchoolConnect Relational Database Design

SchoolConnect uses **PostgreSQL** managed via **Drizzle ORM** (`src/db/schema.ts`).

## Core Entity Relationships

```text
users (ADMIN [email] | TEACHER/PARENT/STUDENT [username School ID])
 ├──< parent_student_links >── students ──> classes ──> academic_years
 ├──< class_subjects >── (classes, subjects)
 ├──< class_timetables >── (classes, subjects, users)
 ├──< fee_records >── (students)
 ├──< gallery_items >── (users)
 ├──< marks >── (students, subjects, exams, classes)
 ├──< attendance >── (students, classes)
 ├──< homework / assignments / notes >── (classes, subjects, users)
 ├──< teacher_remarks >── (students, users, subjects)
 ├──< notices / school_events
 ├──< notifications / messages
 └──< audit_logs
```

## Key Integrity Constraints & Indexes
- `users`: Indexed `username` (`users_username_idx`) for School ID authentication (Teacher, Parent, Student) with `email = NULL` on non-admin roles; `ADMIN` uses unique `email`.
- `marks`: Unique composite index `(student_id, subject_id, exam_id)` prevents duplicate exam results.
- `attendance`: Unique composite index `(student_id, date)` enables atomic daily attendance upserts.
- `parent_student_links`: Unique `(parent_id, student_id)` ensures clean parent-child authorization lookups.
- `class_timetables`: Stores Monday–Saturday period schedules per class, subject, and faculty member.
- `fee_records`: Tracks Tuition, Transport, Exam, and Lab fee items per student (`PAID`, `PENDING`, `OVERDUE`) and unique payment receipt numbers.
- `gallery_items`: Stores campus event photo albums, descriptions, dates, and uploaded/curated media URLs.
- `school_settings`: Stores customizable school name, logo URL, contact metadata, and theme CSS palette (`primary_color`, `secondary_color`, `accent_color`).

