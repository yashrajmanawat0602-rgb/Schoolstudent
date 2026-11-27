import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const schoolSettings = pgTable('school_settings', {
  id: serial('id').primaryKey(),
  schoolName: text('school_name').notNull().default('Macro Vision Academy Burhanpur'),
  tagline: text('tagline')
    .notNull()
    .default('Everything about your child’s school journey — in one place.'),
  logoUrl: text('logo_url')
    .notNull()
    .default('/assets/aistudio/Screenshot_2026-11-21_at_5.47.20_PM_a4b44a58.png'),
  address: text('address').notNull().default('Main Campus'),
  email: text('email').notNull().default('office@schoolconnect.edu'),
  phone: text('phone').notNull().default(''),
  website: text('website').notNull().default(''),
  currentAcademicYear: text('current_academic_year').notNull().default('2026-2027'),
  primaryColor: text('primary_color').notNull().default('#1E3A8A'),
  secondaryColor: text('secondary_color').notNull().default('#0F172A'),
  accentColor: text('accent_color').notNull().default('#D97706'),
  merchantUpiId: text('merchant_upi_id').notNull().default('macrovision.fees@okaxis'),
  merchantPayeeName: text('merchant_payee_name').notNull().default('Macro Vision Academy Burhanpur'),
  bankAccountSummary: text('bank_account_summary')
    .notNull()
    .default('Axis Bank Burhanpur · A/C ••••4821 · IFSC UTIB0001482'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const academicYears = pgTable('academic_years', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isCurrent: boolean('is_current').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').unique(),
    username: text('username'),
    email: text('email').unique(),
    passwordHash: text('password_hash'),
    fullName: text('full_name').notNull(),
    role: text('role').notNull().default('PARENT'), // ADMIN | TEACHER | PARENT | STUDENT
    avatarUrl: text('avatar_url'),
    phone: text('phone'),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_role_idx').on(table.role),
    index('users_username_idx').on(table.username),
  ]
);

export const classes = pgTable(
  'classes',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(), // e.g. "Class 10"
    section: text('section').notNull(), // e.g. "A"
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    classTeacherId: integer('class_teacher_id').references(() => users.id),
    roomNumber: text('room_number').default('101'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('classes_name_section_year_idx').on(
      table.name,
      table.section,
      table.academicYearId
    ),
  ]
);

export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
  department: text('department').notNull().default('General'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const classSubjects = pgTable(
  'class_subjects',
  {
    id: serial('id').primaryKey(),
    classId: integer('class_id')
      .references(() => classes.id, { onDelete: 'cascade' })
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id, { onDelete: 'cascade' })
      .notNull(),
    teacherId: integer('teacher_id')
      .references(() => users.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
  },
  (table) => [
    uniqueIndex('class_subjects_unique_idx').on(
      table.classId,
      table.subjectId,
      table.academicYearId
    ),
  ]
);

export const students = pgTable(
  'students',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id),
    studentCode: text('student_code').notNull().unique(), // e.g. STU-10A-001
    fullName: text('full_name').notNull(),
    classId: integer('class_id')
      .references(() => classes.id)
      .notNull(),
    rollNumber: integer('roll_number').notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    admissionDate: text('admission_date').notNull().default('2026-04-01'),
    gender: text('gender').default('Not specified'),
    dateOfBirth: text('date_of_birth'),
    bloodGroup: text('blood_group'),
    fatherName: text('father_name'),
    motherName: text('mother_name'),
    guardianPhone: text('guardian_phone'),
    guardianEmail: text('guardian_email'),
    address: text('address'),
    emergencyContact: text('emergency_contact'),
    previousSchool: text('previous_school'),
    medicalNotes: text('medical_notes'),
    houseName: text('house_name'),
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('students_class_idx').on(table.classId),
    index('students_user_idx').on(table.userId),
  ]
);

export const parentStudentLinks = pgTable(
  'parent_student_links',
  {
    id: serial('id').primaryKey(),
    parentId: integer('parent_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    relationship: text('relationship').notNull().default('Parent'),
    isPrimary: boolean('is_primary').notNull().default(true),
  },
  (table) => [
    uniqueIndex('parent_student_unique_idx').on(table.parentId, table.studentId),
  ]
);

export const exams = pgTable(
  'exams',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(), // e.g. "Mid-Term Exam"
    examGroup: text('exam_group').notNull().default('Mid-Term 2026'),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    classId: integer('class_id').references(() => classes.id),
    subjectId: integer('subject_id').references(() => subjects.id),
    examDate: text('exam_date').notNull(), // YYYY-MM-DD
    startTime: text('start_time').notNull().default('09:00 AM'),
    durationMinutes: integer('duration_minutes').notNull().default(180),
    maxMarks: integer('max_marks').notNull().default(100),
    room: text('room').default('Main Exam Hall'),
    createdById: integer('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('exams_date_idx').on(table.examDate)]
);

export const marks = pgTable(
  'marks',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    examId: integer('exam_id')
      .references(() => exams.id, { onDelete: 'cascade' })
      .notNull(),
    classId: integer('class_id')
      .references(() => classes.id)
      .notNull(),
    obtainedMarks: integer('obtained_marks').notNull(),
    maxMarks: integer('max_marks').notNull(),
    grade: text('grade').notNull(),
    teacherRemark: text('teacher_remark'),
    uploadedById: integer('uploaded_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('marks_unique_student_subject_exam_idx').on(
      table.studentId,
      table.subjectId,
      table.examId
    ),
    index('marks_student_idx').on(table.studentId),
  ]
);

export const attendance = pgTable(
  'attendance',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    classId: integer('class_id')
      .references(() => classes.id)
      .notNull(),
    subjectId: integer('subject_id').references(() => subjects.id),
    date: text('date').notNull(), // YYYY-MM-DD
    status: text('status').notNull(), // PRESENT | ABSENT | LATE | EXCUSED | HOLIDAY
    note: text('note'),
    recordedById: integer('recorded_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('attendance_student_date_idx').on(table.studentId, table.date),
    index('attendance_class_date_idx').on(table.classId, table.date),
  ]
);

export const homework = pgTable(
  'homework',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    classId: integer('class_id')
      .references(() => classes.id, { onDelete: 'cascade' })
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    teacherId: integer('teacher_id')
      .references(() => users.id)
      .notNull(),
    dueDate: text('due_date').notNull(), // YYYY-MM-DD
    priority: text('priority').notNull().default('MEDIUM'), // LOW | MEDIUM | HIGH
    attachmentName: text('attachment_name'),
    attachmentUrl: text('attachment_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('homework_class_idx').on(table.classId)]
);

export const assignments = pgTable(
  'assignments',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    classId: integer('class_id')
      .references(() => classes.id, { onDelete: 'cascade' })
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    teacherId: integer('teacher_id')
      .references(() => users.id)
      .notNull(),
    dueDate: text('due_date').notNull(), // YYYY-MM-DD
    maxScore: integer('max_score').notNull().default(20),
    status: text('status').notNull().default('OPEN'), // OPEN | CLOSED
    attachmentName: text('attachment_name'),
    attachmentUrl: text('attachment_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('assignments_class_idx').on(table.classId)]
);

export const notes = pgTable(
  'notes',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    chapter: text('chapter').notNull(),
    topic: text('topic').notNull(),
    content: text('content'),
    classId: integer('class_id')
      .references(() => classes.id, { onDelete: 'cascade' })
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    teacherId: integer('teacher_id')
      .references(() => users.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull().default(0),
    fileUrl: text('file_url').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notes_class_subject_idx').on(table.classId, table.subjectId)]
);

export const notices = pgTable(
  'notices',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull().default('ANNOUNCEMENT'), // ANNOUNCEMENT | EXAM | HOLIDAY | PTM | EVENT | EMERGENCY
    priority: text('priority').notNull().default('NORMAL'), // NORMAL | IMPORTANT | URGENT
    isPinned: boolean('is_pinned').notNull().default(false),
    targetRole: text('target_role').notNull().default('ALL'), // ALL | TEACHER | PARENT | STUDENT
    targetClassId: integer('target_class_id').references(() => classes.id),
    authorId: integer('author_id')
      .references(() => users.id)
      .notNull(),
    attachmentName: text('attachment_name'),
    attachmentUrl: text('attachment_url'),
    expiryDate: text('expiry_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notices_pinned_idx').on(table.isPinned)]
);

export const teacherRemarks = pgTable(
  'teacher_remarks',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    teacherId: integer('teacher_id')
      .references(() => users.id)
      .notNull(),
    subjectId: integer('subject_id').references(() => subjects.id),
    remark: text('remark').notNull(),
    category: text('category').notNull().default('ACADEMIC'), // ACADEMIC | BEHAVIOR | PROGRESS
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('remarks_student_idx').on(table.studentId)]
);

export const schoolEvents = pgTable(
  'school_events',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    eventType: text('event_type').notNull().default('EVENT'), // EXAM | PTM | HOLIDAY | EVENT | COMPETITION | DEADLINE
    eventDate: text('event_date').notNull(), // YYYY-MM-DD
    endDate: text('end_date'),
    startTime: text('start_time'),
    location: text('location'),
    classId: integer('class_id').references(() => classes.id),
    createdById: integer('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('school_events_date_idx').on(table.eventDate)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').notNull().default('NOTICE'), // MARKS | HOMEWORK | NOTICE | EXAM | ATTENDANCE | NOTES | REMARK
    linkTab: text('link_tab').default('overview'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_read_idx').on(table.userId, table.isRead)]
);

export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    senderId: integer('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    recipientId: integer('recipient_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    studentId: integer('student_id').references(() => students.id),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('messages_recipient_idx').on(table.recipientId),
    index('messages_sender_idx').on(table.senderId),
  ]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorId: integer('actor_id').references(() => users.id),
    actorName: text('actor_name').notNull(),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    details: text('details').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)]
);

export const classTimetables = pgTable(
  'class_timetables',
  {
    id: serial('id').primaryKey(),
    classId: integer('class_id')
      .references(() => classes.id, { onDelete: 'cascade' })
      .notNull(),
    dayOfWeek: text('day_of_week').notNull(), // MON | TUE | WED | THU | FRI | SAT
    periodNumber: integer('period_number').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    teacherId: integer('teacher_id')
      .references(() => users.id)
      .notNull(),
    room: text('room').default('Room 201'),
  },
  (table) => [index('timetable_class_day_idx').on(table.classId, table.dayOfWeek)]
);

export const feeRecords = pgTable(
  'fee_records',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    category: text('category').notNull().default('TUITION'), // TUITION | TRANSPORT | EXAM | LAB
    amount: integer('amount').notNull(),
    dueDate: text('due_date').notNull(),
    paidDate: text('paid_date'),
    status: text('status').notNull().default('PENDING'), // PAID | PENDING | OVERDUE
    receiptNo: text('receipt_no'),
    paymentMethod: text('payment_method'), // PHONEPE | GOOGLE_PAY | PAYTM | BHIM_UPI | UPI_ID | CARD | NETBANKING | ADMIN_CASH
    transactionRef: text('transaction_ref'), // 12-digit UTR or gateway payment ID
    payerName: text('payer_name'),
    payerPhone: text('payer_phone'),
    payerEmail: text('payer_email'),
    payerUpiId: text('payer_upi_id'),
    paidByUserId: integer('paid_by_user_id').references(() => users.id),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('fee_records_student_idx').on(table.studentId)]
);

export const feePayments = pgTable(
  'fee_payments',
  {
    id: serial('id').primaryKey(),
    feeRecordId: integer('fee_record_id')
      .references(() => feeRecords.id, { onDelete: 'cascade' })
      .notNull(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    parentUserId: integer('parent_user_id')
      .references(() => users.id)
      .notNull(),
    merchantTxnId: text('merchant_txn_id').notNull().unique(),
    gatewayProvider: text('gateway_provider').notNull().default('UPI_INTENT'), // UPI_INTENT | RAZORPAY | ADMIN_DESK
    gatewayOrderId: text('gateway_order_id'),
    gatewayPaymentId: text('gateway_payment_id'),
    paymentMethod: text('payment_method').notNull(), // PHONEPE | GOOGLE_PAY | PAYTM | BHIM_UPI | UPI_ID | CARD | NETBANKING
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('INR'),
    payerName: text('payer_name').notNull(),
    payerPhone: text('payer_phone').notNull(),
    payerEmail: text('payer_email'),
    payerUpiId: text('payer_upi_id'),
    utrNumber: text('utr_number'),
    cardLast4: text('card_last4'),
    status: text('status').notNull().default('INITIATED'), // INITIATED | SUCCESS | FAILED
    upiUri: text('upi_uri'),
    receiptNo: text('receipt_no'),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('fee_payments_fee_idx').on(table.feeRecordId, table.status),
    uniqueIndex('fee_payments_utr_uidx').on(table.utrNumber),
  ]
);

export const galleryItems = pgTable(
  'gallery_items',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    albumName: text('album_name').notNull(),
    eventDate: text('event_date').notNull(),
    imageUrl: text('image_url').notNull(),
    postedById: integer('posted_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('gallery_album_idx').on(table.albumName)]
);

export const studentActivities = pgTable(
  'student_activities',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    classId: integer('class_id')
      .references(() => classes.id, { onDelete: 'cascade' })
      .notNull(),
    uploadedById: integer('uploaded_by_id')
      .references(() => users.id)
      .notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    activityDate: text('activity_date').notNull(), // YYYY-MM-DD
    mediaType: text('media_type').notNull(), // IMAGE | VIDEO
    fileName: text('file_name').notNull(),
    storedFilename: text('stored_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('student_activities_student_idx').on(table.studentId)]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  parentLinks: many(parentStudentLinks),
  taughtSubjects: many(classSubjects),
  notifications: many(notifications),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  classInfo: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  userAccount: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  parentLinks: many(parentStudentLinks),
  marks: many(marks),
  attendance: many(attendance),
  remarks: many(teacherRemarks),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  academicYear: one(academicYears, {
    fields: [classes.academicYearId],
    references: [academicYears.id],
  }),
  classTeacher: one(users, {
    fields: [classes.classTeacherId],
    references: [users.id],
  }),
  students: many(students),
  classSubjects: many(classSubjects),
}));
