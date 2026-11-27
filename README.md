# 🎓 SchoolConnect

**“Everything about your child’s school journey — in one place.”**  
*Connecting School, Teachers & Parents — One Smart Dashboard.*

SchoolConnect is a full-stack, role-based educational management platform built for schools, teachers, students, and parents with strict student-data privacy isolation, PostgreSQL relational persistence, and a responsive Light / Dark / School Theme UI.

---

## Key Features

### Parent Portal
- **Multi-Child Switcher**: Seamlessly switch between enrolled children (e.g. *Aarav — Class 10-A* and *Anaya — Class 7-B*).
- **Academic Performance & Report Cards**: Subject performance vs. anonymized class averages, exam-wise comparison charts, overall percentage, and printable report cards.
- **Class Timetable & Attendance Calendar**: Weekly Mon–Sat period timetable and dual-coded attendance calendar (`Present`, `Absent`, `Late`, `Excused`, `Holiday`).
- **Fee Status & Receipts**: Track tuition, lab, exam, and transport fee dues, record online payments, and download fee payment receipts.
- **Campus Media Gallery**: View school function albums, science exhibitions, sports meets, and STEM showcases.
- **Homework, Assignments & Digital Notes Library**: Search and download teacher study notes (`PDF`, `DOCX`, `PPTX`, `Images`, `Text`) organized by Class → Subject → Chapter → Topic.
- **Exam Timetable, Notice Board, School Calendar & Direct Messaging**: Stay updated on PTMs, exams, teacher remarks, and real-time notifications.

### Teacher Workspace
- **Marks Management & CSV Bulk Import**: Enter, edit, or delete marks (`Class → Subject → Exam → Student`) and bulk-import CSV spreadsheets with strict per-row validation.
- **Daily Attendance Register**: Mark class attendance with automatic parent alerts for `Absent` or `Late` entries.
- **Content, Campus Gallery & Communication**: Post homework, graded assignments, upload study materials, publish notices, post campus event gallery updates, schedule exams, and add private student remarks.

### Student Portal
- View personal academic progress, class timetable, fee statements, campus gallery, marks, attendance calendar, homework, study notes, exam timetable, notices, and academic profile.

### School Administrator Console
- **School-Wide Analytics & Fee Management**: Enrollment, attendance, academic averages, and class-wide fee invoicing & payment tracking.
- **User & RBAC Governance**: Issue School IDs for `Teacher`, `Parent`, and `Student` accounts, and manage Email/Google SSO access strictly for `Admin` accounts.
- **Academic Structure**: Manage classes, sections, subjects, teacher allocations, academic years, and parent–student links.
- **School Branding & Audit Logs**: Customize school name, logo, contact details, primary/accent theme colors, and inspect full security audit logs.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Recharts, Lucide Icons
- **Backend**: Node.js + Express (REST API with Helmet security headers, Zod input validation, and rate limiting)
- **Database**: PostgreSQL (Cloud SQL) with Drizzle ORM (`drizzle-orm/node-postgres`)
- **Authentication**: School ID / Username + salted `scrypt` password hashing for Parent/Teacher/Student; Google Sign-In strictly restricted to `yashrajmanawat0602@gmail.com` for Administrator access
- **Testing**: Vitest

---

## Safe Demo Accounts & Auth Policy

Email and Gmail login are strictly restricted to the **Administrator** account (`yashrajmanawat0602@gmail.com` via Google Sign-In only). Teachers, Parents, and Students sign in using their issued **School ID / Username**.

| Role | School ID / Login Method | Password | Highlights |
| :--- | :--- | :--- | :--- |
| **Parent** | `PAR-SHARMA` | `Demo@2026!` | Linked to 2 children: Aarav (10-A) & Anaya (7-B) |
| **Teacher** | `TCH-001` | `Demo@2026!` | Assigned to Class 10-A, 10-B & 7-B |
| **Student** | `STU-10A-001` | `Demo@2026!` | Aarav Sharma (Class 10-A, Roll #1) |
| **Admin** | `yashrajmanawat0602@gmail.com` *(Google SSO only)* | — | Full school branding, RBAC, fees & audit access |

---

## Installation & Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Push Drizzle schema to PostgreSQL
npx drizzle-kit push --config=src/db/drizzle.config.ts

# 4. Run development server (Express API + Vite frontend on port 3000)
npm run dev

# 5. Run automated tests & typecheck
npm run lint
npm test
```

---

## Documentation

- [System Architecture](docs/architecture.md)
- [Database Schema & Relationships](docs/database.md)
- [GitHub & Cloud Deployment Guide](docs/deployment.md)

---

## Security Highlights

- **Strict Server-Side RBAC**: Every protected endpoint derives identity from verified Bearer tokens and checks resource ownership (`Parent ↔ Student`, `Student ↔ Self`, `Teacher ↔ Assigned Class`).
- **Privacy Protection**: Class averages are computed as anonymized aggregates; peer student identities are never leaked to parents or students.
- **Credential & File Safety**: Salted `scrypt` password hashing, MIME/extension and 10 MB upload limits, path-traversal confinement, and full audit logging.
