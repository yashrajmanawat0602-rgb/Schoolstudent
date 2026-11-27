export type UserRole = 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';

export type ThemeMode = 'light' | 'dark' | 'school';

export interface SchoolSettings {
  id: number;
  schoolName: string;
  tagline: string;
  logoUrl: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  currentAcademicYear: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  merchantUpiId?: string;
  merchantPayeeName?: string;
  bankAccountSummary?: string;
}

export interface AuthUser {
  id: number;
  username: string | null;
  email: string | null;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
}

export interface ChildSummary {
  id: number;
  studentCode: string;
  fullName: string;
  rollNumber: number;
  classId: number;
  className: string;
  section: string;
  relationship: string;
  avatarUrl: string | null;
}

export interface TeacherClassAssignment {
  classId: number;
  className: string;
  section: string;
  subjectId: number;
  subjectName: string;
}

export interface SessionContextData {
  user: AuthUser;
  children: ChildSummary[];
  studentProfile: Omit<ChildSummary, 'relationship'> | null;
  teacherClasses: TeacherClassAssignment[];
  schoolSettings: SchoolSettings | null;
}

export interface StudentDetailRecord {
  id: number;
  studentCode: string;
  fullName: string;
  rollNumber: number;
  classId: number;
  className: string;
  section: string;
  roomNumber?: string | null;
  admissionDate: string;
  gender: string | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  fatherName: string | null;
  motherName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  address: string | null;
  emergencyContact: string | null;
  previousSchool: string | null;
  medicalNotes: string | null;
  houseName: string | null;
  avatarUrl: string | null;
  isActive?: boolean;
  hasPortalAccount?: boolean;
}

export interface StudentOverviewResponse {
  student: StudentDetailRecord;
  marks: Array<{
    id: number;
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    examId: number;
    examName: string;
    examDate: string;
    obtainedMarks: number;
    maxMarks: number;
    grade: string;
    teacherRemark: string | null;
    percentage: number;
    classAveragePct: number | null;
  }>;
  attendance: {
    records: Array<{
      id: number;
      date: string;
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'HOLIDAY';
      note: string | null;
    }>;
    summary: {
      totalSchoolDays: number;
      present: number;
      late: number;
      absent: number;
      excused: number;
      percentage: number;
    };
  };
  homework: HomeworkItem[];
  assignments: AssignmentItem[];
  upcomingExams: ExamItem[];
  remarks: Array<{
    id: number;
    remark: string;
    category: string;
    createdAt: string;
    teacherName: string;
    subjectName: string | null;
  }>;
  subjects: Array<{
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    teacherId: number;
    teacherName: string;
    teacherUsername: string | null;
  }>;
  insights: string[];
  activities?: StudentActivityItem[];
}

export interface StudentActivityItem {
  id: number;
  studentId: number;
  classId: number;
  title: string;
  description: string;
  activityDate: string;
  mediaType: 'IMAGE' | 'VIDEO';
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  mediaUrl: string;
  uploadedByName: string;
  createdAt: string;
}

export interface HomeworkItem {
  id: number;
  title: string;
  description: string;
  classId?: number;
  className?: string;
  section?: string;
  subjectId?: number;
  subjectName: string;
  teacherName: string;
  dueDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  attachmentName?: string | null;
  attachmentUrl?: string | null;
}

export interface AssignmentItem {
  id: number;
  title: string;
  description: string;
  classId?: number;
  className?: string;
  section?: string;
  subjectName: string;
  teacherName: string;
  dueDate: string;
  maxScore: number;
  status: string;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
}

export interface StudyNoteItem {
  id: number;
  title: string;
  chapter: string;
  topic: string;
  content: string | null;
  classId: number;
  className: string;
  section: string;
  subjectId: number;
  subjectName: string;
  teacherName: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  fileUrl: string;
  createdAt: string;
}

export interface ExamItem {
  id: number;
  name: string;
  examGroup: string;
  classId?: number | null;
  className?: string | null;
  section?: string | null;
  subjectId?: number | null;
  subjectName?: string | null;
  examDate: string;
  startTime: string;
  durationMinutes: number;
  maxMarks: number;
  room: string | null;
}

export interface NoticeItem {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  isPinned: boolean;
  targetRole: string;
  authorName: string;
  authorRole: string;
  expiryDate: string | null;
  createdAt: string;
}

export interface SchoolEventItem {
  id: number;
  title: string;
  description: string | null;
  eventType: 'EXAM' | 'PTM' | 'HOLIDAY' | 'EVENT' | 'COMPETITION' | 'DEADLINE';
  eventDate: string;
  endDate: string | null;
  startTime: string | null;
  location: string | null;
  classId: number | null;
}

export interface NotificationItem {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  linkTab: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface MessageItem {
  id: number;
  senderId: number;
  recipientId: number;
  studentId: number | null;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  senderName: string;
  senderRole: string;
  recipientName: string;
  recipientRole: string;
}

export interface AuditLogItem {
  id: number;
  actorId: number | null;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export interface TimetableEntry {
  id: number;
  classId: number;
  className: string;
  section: string;
  dayOfWeek: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  teacherId: number;
  teacherName: string;
  room: string | null;
}

export interface FeeRecordItem {
  id: number;
  studentId: number;
  title: string;
  category: 'TUITION' | 'TRANSPORT' | 'EXAM' | 'LAB' | string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | string;
  receiptNo: string | null;
  paymentMethod?: string | null;
  transactionRef?: string | null;
  payerName?: string | null;
  payerPhone?: string | null;
  payerEmail?: string | null;
  payerUpiId?: string | null;
}

export interface FeeMerchantConfig {
  upiId: string;
  payeeName: string;
  bankAccountSummary: string;
  gatewayMode: 'RAZORPAY' | 'UPI_DIRECT';
}

export interface FeePayerDefaults {
  fullName: string;
  phone: string;
  email: string;
  studentName: string;
  studentCode: string;
  className: string;
  section: string;
  rollNumber: number;
  fatherName: string;
}

export interface FeesSummaryResponse {
  summary: {
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
  };
  records: FeeRecordItem[];
  merchantConfig?: FeeMerchantConfig;
  payerDefaults?: FeePayerDefaults;
}

export interface FeePaymentIntentResponse {
  paymentId: number;
  merchantTxnId: string;
  integrityToken: string;
  gatewayProvider: 'RAZORPAY' | 'UPI_INTENT';
  razorpayKeyId?: string;
  gatewayOrderId?: string;
  amount: number;
  currency: 'INR';
  paymentMethod: string;
  merchantUpiId: string;
  merchantPayeeName: string;
  bankAccountSummary: string;
  upiLinks: {
    upiUri: string;
    phonePeUri: string;
    gpayUri: string;
    paytmUri: string;
  };
  qrDataUrl: string;
  expiresAt: string;
}

export interface FeePaymentReceiptResponse {
  success: boolean;
  feeRecord: FeeRecordItem;
  receipt: {
    receiptNo: string;
    transactionRef: string;
    merchantTxnId: string;
    paymentMethod: string;
    amount: number;
    paidDate: string;
    paidAt: string;
    payerName: string;
    payerPhone: string;
    payerEmail: string | null;
    payerUpiId: string | null;
    studentName: string;
    studentCode: string;
    className: string;
    section: string;
    feeTitle: string;
    feeCategory: string;
  };
}

export interface GalleryItem {
  id: number;
  title: string;
  description: string;
  albumName: string;
  eventDate: string;
  imageUrl: string;
  postedByName: string;
  createdAt: string;
}
