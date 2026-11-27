import { count, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
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
} from './schema.ts';
import { computeGrade, hashPassword } from '../utils/security.ts';

declare global {
  var _seedPromise: Promise<void> | undefined;
  var _seedVerified: boolean | undefined;
}

export const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || 'Demo@2026!';

const REGULATED_TEACHERS_AND_CLASSES = [
  { username: 'TCH-01', fullName: 'Sunil Kumar Sen', phone: '+91 98260 20001', className: 'Class 9', section: 'VECTOR', roomNumber: '402' },
  { username: 'TCH-02', fullName: 'Prabhat Ranjan', phone: '+91 98260 20002', className: 'Class 9', section: 'ZENITH', roomNumber: '401' },
  { username: 'TCH-03', fullName: 'Kamlesh Verma', phone: '+91 98260 20003', className: 'Class 9', section: 'DEAFENDER', roomNumber: '403' },
  { username: 'TCH-04', fullName: 'Dr. Anita Desai', phone: '+91 98260 20004', className: 'Class 10', section: 'ALPHA', roomNumber: '501' },
  { username: 'TCH-05', fullName: 'Ms. Eleanor Vance', phone: '+91 98260 20005', className: 'Class 10', section: 'BETA', roomNumber: '502' },
  { username: 'TCH-06', fullName: 'Mr. Rajesh Nair', phone: '+91 98260 20006', className: 'Class 8', section: 'ALPHA', roomNumber: '301' },
  { username: 'TCH-07', fullName: 'Ms. Priyanka Bose', phone: '+91 98260 20007', className: 'Class 8', section: 'BETA', roomNumber: '302' },
  { username: 'TCH-08', fullName: 'Mrs. Deepa Menon', phone: '+91 98260 20008', className: 'Class 7', section: 'ALPHA', roomNumber: '201' },
  { username: 'TCH-09', fullName: 'Mr. Arvind Joshi', phone: '+91 98260 20009', className: 'Class 7', section: 'BETA', roomNumber: '202' },
  { username: 'TCH-10', fullName: 'Ms. Neha Kapoor', phone: '+91 98260 20010', className: 'Class 6', section: 'ALPHA', roomNumber: '101' },
];

const CORE_SUBJECTS = [
  { name: 'Mathematics', code: 'MATH', department: 'Mathematics' },
  { name: 'Physics', code: 'PHY', department: 'Sciences' },
  { name: 'Chemistry', code: 'CHEM', department: 'Sciences' },
  { name: 'Biology', code: 'BIO', department: 'Sciences' },
  { name: 'English', code: 'ENG', department: 'Languages' },
  { name: 'Hindi', code: 'HIN', department: 'Languages' },
  { name: 'Social Science', code: 'SST', department: 'Humanities' },
  { name: 'Computer Science', code: 'CS', department: 'Technology' },
];

const STUDENT_FIRST_NAMES_MALE = [
  'Aarav', 'Vihaan', 'Kabir', 'Rohan', 'Arjun', 'Vivaan', 'Aditya', 'Reyansh',
  'Siddharth', 'Dev', 'Pranav', 'Harsh', 'Karan', 'Nikhil', 'Yash', 'Aryan',
  'Tanmay', 'Manav', 'Rishabh', 'Parth', 'Om', 'Kunal', 'Samarth', 'Lakshya',
  'Atharv', 'Shaurya', 'Rudra', 'Ansh', 'Kartik', 'Varun',
];

const STUDENT_FIRST_NAMES_FEMALE = [
  'Anaya', 'Diya', 'Ishita', 'Meera', 'Saanvi', 'Kavya', 'Naina', 'Tara',
  'Riya', 'Zoya', 'Aditi', 'Nandini', 'Shruti', 'Anjali', 'Sneha', 'Pooja',
  'Khushi', 'Vanshika', 'Prisha', 'Myra', 'Aadhya', 'Avni', 'Siya', 'Pari',
  'Ira', 'Navya', 'Manya', 'Palak', 'Kriti', 'Tanvi',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Verma', 'Jaiswal', 'Gupta', 'Tiwari', 'Choudhary', 'Kulkarni',
  'Deshmukh', 'Joshi', 'Mehta', 'Singh', 'Agrawal', 'Mishra', 'Dubey', 'Pandey',
  'Nair', 'Saxena', 'Bhatt', 'Rathore',
];

const FATHER_FIRST_NAMES = [
  'Rajesh', 'Vikram', 'Suresh', 'Mahesh', 'Dinesh', 'Alok', 'Sanjay', 'Pankaj',
  'Nitin', 'Prashant', 'Mukesh', 'Anil', 'Rakesh', 'Vinod', 'Deepak', 'Ashok',
];

const MOTHER_FIRST_NAMES = [
  'Sunita', 'Priya', 'Kavita', 'Rekha', 'Anita', 'Meenakshi', 'Seema', 'Pooja',
  'Vandana', 'Shalini', 'Archana', 'Suman', 'Neha', 'Ritu', 'Mamta', 'Jyoti',
];

const BLOOD_GROUPS = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-'];
const HOUSES = ['Aryabhatta House', 'Vivekananda House', 'Tagore House', 'Raman House'];
const BURHANPUR_STREETS = [
  'Lalbagh Road', 'Shikarpura Colony', 'Sindhi Basti', 'Raver Road',
  'Shanwara Gate', 'Indira Colony', 'Civil Lines', 'Bahadurpur Road',
  'Itwara Bazaar', 'Ganpati Naka', 'Mahajanpeth', 'Amravati Road',
];
const PREVIOUS_SCHOOLS = [
  'Macro Vision Primary Wing, Burhanpur',
  'St. Xavier Public School, Burhanpur',
  'Kendriya Vidyalaya, Burhanpur',
  'Sacred Heart Convent School, Burhanpur',
  'Nehru Montessori Senior Secondary School',
];
const MEDICAL_NOTES_POOL = [
  'No known allergies. Medically fit for all sports.',
  'No known allergies. Annual health checkup cleared.',
  'Wears prescription spectacles during reading.',
  'Mild seasonal dust allergy; no medication restrictions.',
  'No known allergies. Active in athletics.',
];

function getClassTag(className: string, section: string): string {
  const numMatch = className.match(/\d+/);
  const grade = numMatch ? numMatch[0] : className.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase();
  const sec = section.trim().toUpperCase().slice(0, 1) || 'A';
  return `${grade}${sec}`;
}

function getBirthYearForClass(className: string): number {
  const numMatch = className.match(/\d+/);
  const grade = numMatch ? Number(numMatch[0]) : 9;
  // In academic year 2026-2027, Class 10 ~ 2010-2011, Class 9 ~ 2011-2012, etc.
  return Math.max(2007, Math.min(2020, 2020 - grade));
}

function buildStudentDetails(params: {
  seedIndex: number;
  fullName: string;
  className: string;
  rollNumber: number;
  gender?: string | null;
}) {
  const { seedIndex, fullName, className, rollNumber } = params;
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts[parts.length - 1] : LAST_NAMES[seedIndex % LAST_NAMES.length];
  const birthYear = getBirthYearForClass(className);
  const month = String(((seedIndex + rollNumber) % 12) + 1).padStart(2, '0');
  const day = String(((seedIndex * 3 + rollNumber * 2) % 27) + 1).padStart(2, '0');

  const gender =
    params.gender && params.gender !== 'Not specified'
      ? params.gender
      : rollNumber % 2 === 0
        ? 'Female'
        : 'Male';

  const fatherFirst = FATHER_FIRST_NAMES[(seedIndex + rollNumber) % FATHER_FIRST_NAMES.length];
  const motherFirst = MOTHER_FIRST_NAMES[(seedIndex + rollNumber * 2) % MOTHER_FIRST_NAMES.length];
  const phoneSuffix = String(10000 + ((seedIndex * 137 + rollNumber * 19) % 89999)).slice(-5);
  const emgSuffix = String(20000 + ((seedIndex * 193 + rollNumber * 23) % 79999)).slice(-5);
  const cleanEmailName = `${fatherFirst}.${lastName}${seedIndex}`
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '');

  return {
    gender,
    dateOfBirth: `${birthYear}-${month}-${day}`,
    bloodGroup: BLOOD_GROUPS[(seedIndex + rollNumber) % BLOOD_GROUPS.length],
    fatherName: `Mr. ${fatherFirst} ${lastName}`,
    motherName: `Mrs. ${motherFirst} ${lastName}`,
    guardianPhone: `+91 9826${seedIndex % 9} ${phoneSuffix}`,
    guardianEmail: `${cleanEmailName}@burhanpur.edu`,
    address: `${10 + ((seedIndex * 7 + rollNumber) % 88)} ${BURHANPUR_STREETS[(seedIndex + rollNumber) % BURHANPUR_STREETS.length]}, Burhanpur, MP 450331`,
    emergencyContact: `+91 9425${seedIndex % 9} ${emgSuffix} (Family Guardian)`,
    previousSchool: PREVIOUS_SCHOOLS[(seedIndex + rollNumber) % PREVIOUS_SCHOOLS.length],
    medicalNotes: MEDICAL_NOTES_POOL[(seedIndex + rollNumber) % MEDICAL_NOTES_POOL.length],
    houseName: HOUSES[(seedIndex + rollNumber) % HOUSES.length],
  };
}

export async function ensureSeeded(): Promise<void> {
  if (global._seedVerified) return;
  if (!global._seedPromise) {
    global._seedPromise = runSeedIfEmpty().catch((err) => {
      global._seedPromise = undefined;
      throw err;
    });
  }
  await global._seedPromise;
}

async function runSeedIfEmpty(): Promise<void> {
  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  if (Number(userCount) > 0) {
    global._seedVerified = true;
    return;
  }

  console.log('Initializing Macro Vision Academy Burhanpur PostgreSQL database...');
  await syncRegulatedDemoData();
  global._seedVerified = true;
}

export async function syncRegulatedDemoData(): Promise<{
  teachers: number;
  classes: number;
  students: number;
  parents: number;
  marks: number;
  attendance: number;
}> {
  const demoPasswordHash = hashPassword(DEMO_PASSWORD);

  // 1. School Settings
  const existingSettings = await db.select().from(schoolSettings).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(schoolSettings).values({
      schoolName: 'Macro Vision Academy Burhanpur',
      tagline: 'Everything about your child’s school journey — in one place.',
      logoUrl: '/assets/aistudio/Screenshot_2026-11-21_at_5.47.20_PM_a4b44a58.png',
      address: 'Renuka Mata Road, Burhanpur, Madhya Pradesh 450331',
      email: 'office@macrovisionburhanpur.edu',
      phone: '+91 7325 255100',
      website: 'https://macrovisionburhanpur.edu',
      currentAcademicYear: '2026-2027',
      primaryColor: '#1E3A8A',
      secondaryColor: '#0F172A',
      accentColor: '#D97706',
    });
  }

  // 2. Academic Years
  let allYears = await db.select().from(academicYears);
  if (allYears.length === 0) {
    allYears = await db
      .insert(academicYears)
      .values([
        { name: '2025-2026', startDate: '2025-04-01', endDate: '2026-03-31', isCurrent: false },
        { name: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', isCurrent: true },
      ])
      .returning();
  }
  const currentYear = allYears.find((y) => y.isCurrent) || allYears[allYears.length - 1];

  // 3. Admin Account
  let [adminUser] = await db.select().from(users).where(eq(users.role, 'ADMIN')).limit(1);
  if (!adminUser) {
    const adminPasswordHash = process.env.ADMIN_INITIAL_PASSWORD
      ? hashPassword(process.env.ADMIN_INITIAL_PASSWORD)
      : demoPasswordHash;
    [adminUser] = await db
      .insert(users)
      .values({
        username: process.env.ADMIN_USERNAME || 'Adminmva',
        email: null,
        passwordHash: adminPasswordHash,
        fullName: 'School Administrator',
        role: 'ADMIN',
        phone: '+91 7325 255101',
        avatarUrl: '/src/assets/images/avatar_teacher_1_1795235450705.jpg',
        isActive: true,
      })
      .returning();
  }

  // 4. Core Subjects (preserve existing codes & add missing ones)
  let existingSubjects = await db.select().from(subjects);
  const existingCodes = new Set(existingSubjects.map((s) => s.code.toUpperCase()));
  const existingNames = new Set(existingSubjects.map((s) => s.name.toLowerCase()));
  for (const sub of CORE_SUBJECTS) {
    if (!existingCodes.has(sub.code.toUpperCase()) && !existingNames.has(sub.name.toLowerCase())) {
      const [inserted] = await db.insert(subjects).values(sub).returning();
      existingSubjects.push(inserted);
      existingCodes.add(inserted.code.toUpperCase());
    }
  }
  const mathSub = existingSubjects.find((s) => s.code.toUpperCase() === 'MATH') || existingSubjects[0];
  const phySub = existingSubjects.find((s) => s.code.toUpperCase() === 'PHY') || existingSubjects[1] || mathSub;
  const engSub = existingSubjects.find((s) => s.code.toUpperCase() === 'ENG') || existingSubjects[2] || mathSub;
  const sstSub = existingSubjects.find((s) => s.code.toUpperCase() === 'SST') || existingSubjects[3] || mathSub;
  const csSub = existingSubjects.find((s) => s.code.toUpperCase() === 'CS') || phySub;

  // 5. Regulated Teachers <-> Homeroom Classes (1 teacher = 1 class)
  for (const spec of REGULATED_TEACHERS_AND_CLASSES) {
    let [teacher] = await db
      .select()
      .from(users)
      .where(sql`UPPER(${users.username}) = ${spec.username.toUpperCase()}`)
      .limit(1);

    if (!teacher) {
      [teacher] = await db
        .insert(users)
        .values({
          username: spec.username,
          email: null,
          passwordHash: demoPasswordHash,
          fullName: spec.fullName,
          role: 'TEACHER',
          phone: spec.phone,
          avatarUrl: '/src/assets/images/avatar_teacher_1_1795235450705.jpg',
          isActive: true,
        })
        .returning();
    }

    const existingClassRows = await db.select().from(classes);
    const matchingClass = existingClassRows.find(
      (c) =>
        c.name.toLowerCase() === spec.className.toLowerCase() &&
        c.section.toLowerCase() === spec.section.toLowerCase() &&
        c.academicYearId === currentYear.id
    );

    if (!matchingClass) {
      await db.insert(classes).values({
        name: spec.className,
        section: spec.section,
        academicYearId: currentYear.id,
        classTeacherId: teacher.id,
        roomNumber: spec.roomNumber,
      });
    } else if (!matchingClass.classTeacherId) {
      await db
        .update(classes)
        .set({ classTeacherId: teacher.id })
        .where(eq(classes.id, matchingClass.id));
    }
  }

  // Ensure every teacher has a homeroom class and every class has a homeroom teacher
  const allTeachers = await db.select().from(users).where(eq(users.role, 'TEACHER'));
  let allClasses = await db.select().from(classes);
  const assignedTeacherIds = new Set(
    allClasses.map((c) => c.classTeacherId).filter((id): id is number => Boolean(id))
  );

  let extraClassCounter = 1;
  for (const t of allTeachers) {
    if (!assignedTeacherIds.has(t.id)) {
      const unassignedClass = allClasses.find((c) => !c.classTeacherId);
      if (unassignedClass) {
        await db
          .update(classes)
          .set({ classTeacherId: t.id })
          .where(eq(classes.id, unassignedClass.id));
        unassignedClass.classTeacherId = t.id;
        assignedTeacherIds.add(t.id);
      } else {
        const [newCls] = await db
          .insert(classes)
          .values({
            name: `Class ${5 + extraClassCounter}`,
            section: 'OMEGA',
            academicYearId: currentYear.id,
            classTeacherId: t.id,
            roomNumber: String(110 + extraClassCounter),
          })
          .returning();
        allClasses.push(newCls);
        assignedTeacherIds.add(t.id);
        extraClassCounter++;
      }
    }
  }
  allClasses = await db.select().from(classes);

  // 6. Subject Allocations (classSubjects) for every class
  const existingCS = await db.select().from(classSubjects);
  const csKeySet = new Set(
    existingCS.map((cs) => `${cs.classId}:${cs.subjectId}:${cs.academicYearId}`)
  );
  const newCS: Array<{
    classId: number;
    subjectId: number;
    teacherId: number;
    academicYearId: number;
  }> = [];

  allClasses.forEach((cls, cIdx) => {
    const homeroomTeacherId = cls.classTeacherId || allTeachers[cIdx % allTeachers.length].id;
    existingSubjects.forEach((sub, sIdx) => {
      const key = `${cls.id}:${sub.id}:${currentYear.id}`;
      if (!csKeySet.has(key)) {
        const teacherId =
          sIdx < 2 ? homeroomTeacherId : allTeachers[(cIdx + sIdx) % allTeachers.length].id;
        newCS.push({
          classId: cls.id,
          subjectId: sub.id,
          teacherId,
          academicYearId: currentYear.id,
        });
        csKeySet.add(key);
      }
    });
  });
  if (newCS.length > 0) {
    await db.insert(classSubjects).values(newCS);
  }

  // 7. Enroll any orphan STUDENT user (e.g. STU-RAJ Rajveer Jaiswal) who has no students row yet
  const allUsers = await db.select().from(users);
  let allStudents = await db.select().from(students);
  const linkedStudentUserIds = new Set(
    allStudents.map((s) => s.userId).filter((id): id is number => Boolean(id))
  );
  const existingStudentCodes = new Set(allStudents.map((s) => s.studentCode.toUpperCase()));

  const orphanStudentUsers = allUsers.filter(
    (u) => u.role === 'STUDENT' && !linkedStudentUserIds.has(u.id)
  );
  for (const stuUser of orphanStudentUsers) {
    // Prefer an empty class first (like Class 9 VECTOR)
    const studentCountsByClass = new Map<number, number>();
    for (const st of allStudents) {
      studentCountsByClass.set(st.classId, (studentCountsByClass.get(st.classId) || 0) + 1);
    }
    const targetClass =
      allClasses.find((c) => (studentCountsByClass.get(c.id) || 0) === 0) || allClasses[0];
    const classStudents = allStudents.filter((s) => s.classId === targetClass.id);
    const usedRolls = new Set(classStudents.map((s) => s.rollNumber));
    let nextRoll = 1;
    while (usedRolls.has(nextRoll)) nextRoll++;

    const code = (stuUser.username || `STU-${getClassTag(targetClass.name, targetClass.section)}-${String(nextRoll).padStart(3, '0')}`).toUpperCase();
    if (!existingStudentCodes.has(code)) {
      const details = buildStudentDetails({
        seedIndex: stuUser.id + nextRoll,
        fullName: stuUser.fullName,
        className: targetClass.name,
        rollNumber: nextRoll,
        gender: 'Male',
      });
      const [inserted] = await db
        .insert(students)
        .values({
          userId: stuUser.id,
          studentCode: code,
          fullName: stuUser.fullName,
          classId: targetClass.id,
          rollNumber: nextRoll,
          academicYearId: currentYear.id,
          admissionDate: '2026-04-02',
          avatarUrl: '/src/assets/images/avatar_student_1_1795235450731.jpg',
          isActive: true,
          ...details,
        })
        .returning();
      allStudents.push(inserted);
      existingStudentCodes.add(code);
      linkedStudentUserIds.add(stuUser.id);
    }
  }

  // 8. Backfill missing profile details, portal accounts, and parent links on ALL existing students
  for (let i = 0; i < allStudents.length; i++) {
    const stu = allStudents[i];
    const cls = allClasses.find((c) => c.id === stu.classId) || allClasses[0];
    const filled = buildStudentDetails({
      seedIndex: stu.id + i,
      fullName: stu.fullName,
      className: cls.name,
      rollNumber: stu.rollNumber,
      gender: stu.gender,
    });

    const needsProfileUpdate =
      !stu.dateOfBirth ||
      !stu.bloodGroup ||
      !stu.fatherName ||
      !stu.motherName ||
      !stu.guardianPhone ||
      !stu.guardianEmail ||
      !stu.address ||
      !stu.emergencyContact ||
      !stu.previousSchool ||
      !stu.medicalNotes ||
      !stu.houseName ||
      !stu.gender ||
      stu.gender === 'Not specified';

    let userId = stu.userId;
    if (!userId) {
      const [existingUser] = await db
        .select()
        .from(users)
        .where(sql`UPPER(${users.username}) = ${stu.studentCode.toUpperCase()}`)
        .limit(1);
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const [newStuUser] = await db
          .insert(users)
          .values({
            username: stu.studentCode.toUpperCase(),
            email: null,
            passwordHash: demoPasswordHash,
            fullName: stu.fullName,
            role: 'STUDENT',
            phone: stu.guardianPhone || filled.guardianPhone,
            avatarUrl: '/src/assets/images/avatar_student_1_1795235450731.jpg',
            isActive: true,
          })
          .returning();
        userId = newStuUser.id;
      }
    }

    if (needsProfileUpdate || userId !== stu.userId) {
      const [updated] = await db
        .update(students)
        .set({
          userId,
          gender: stu.gender && stu.gender !== 'Not specified' ? stu.gender : filled.gender,
          dateOfBirth: stu.dateOfBirth || filled.dateOfBirth,
          bloodGroup: stu.bloodGroup || filled.bloodGroup,
          fatherName: stu.fatherName || filled.fatherName,
          motherName: stu.motherName || filled.motherName,
          guardianPhone: stu.guardianPhone || filled.guardianPhone,
          guardianEmail: stu.guardianEmail || filled.guardianEmail,
          address: stu.address || filled.address,
          emergencyContact: stu.emergencyContact || filled.emergencyContact,
          previousSchool: stu.previousSchool || filled.previousSchool,
          medicalNotes: stu.medicalNotes || filled.medicalNotes,
          houseName: stu.houseName || filled.houseName,
          avatarUrl: stu.avatarUrl || '/src/assets/images/avatar_student_1_1795235450731.jpg',
        })
        .where(eq(students.id, stu.id))
        .returning();
      allStudents[i] = updated;
    }

    const existingLinks = await db
      .select()
      .from(parentStudentLinks)
      .where(eq(parentStudentLinks.studentId, stu.id));

    if (existingLinks.length === 0) {
      const parentUsername = `PAR-${stu.studentCode.replace(/^STU-/, '').toUpperCase()}`;
      let [parUser] = await db
        .select()
        .from(users)
        .where(sql`UPPER(${users.username}) = ${parentUsername}`)
        .limit(1);
      if (!parUser) {
        [parUser] = await db
          .insert(users)
          .values({
            username: parentUsername,
            email: null,
            passwordHash: demoPasswordHash,
            fullName: filled.fatherName,
            role: 'PARENT',
            phone: filled.guardianPhone,
            avatarUrl: '/src/assets/images/avatar_parent_1_1795235450625.jpg',
            isActive: true,
          })
          .returning();
      }
      await db.insert(parentStudentLinks).values({
        parentId: parUser.id,
        studentId: stu.id,
        relationship: 'Father',
        isPrimary: true,
      });
    }
  }

  // 9. Ensure EVERY Class has 6 regulated demo students (Roll #1..#6) with full details, login & parent
  let nameCursor = 0;
  for (let cIdx = 0; cIdx < allClasses.length; cIdx++) {
    const cls = allClasses[cIdx];
    const tag = getClassTag(cls.name, cls.section);
    const classStudents = allStudents.filter((s) => s.classId === cls.id);
    const usedRolls = new Set(classStudents.map((s) => s.rollNumber));

    for (let roll = 1; roll <= 6; roll++) {
      if (classStudents.length >= 6 && usedRolls.has(roll)) continue;
      if (usedRolls.has(roll)) continue;

      const isFemale = roll % 2 === 0;
      const firstPool = isFemale ? STUDENT_FIRST_NAMES_FEMALE : STUDENT_FIRST_NAMES_MALE;
      const firstNameRaw = firstPool[(nameCursor + cIdx * 3 + roll) % firstPool.length];
      const firstName = firstNameRaw.charAt(0).toUpperCase() + firstNameRaw.slice(1);
      const lastName = LAST_NAMES[(nameCursor + cIdx * 5 + roll) % LAST_NAMES.length];
      const fullName = `${firstName} ${lastName}`;
      nameCursor++;

      let studentCode = `STU-${tag}-${String(roll).padStart(3, '0')}`;
      if (existingStudentCodes.has(studentCode)) {
        studentCode = `STU-${tag}-${String(roll + 10).padStart(3, '0')}`;
      }

      const details = buildStudentDetails({
        seedIndex: cIdx * 10 + roll,
        fullName,
        className: cls.name,
        rollNumber: roll,
        gender: isFemale ? 'Female' : 'Male',
      });

      // Student user account
      let [stuUser] = await db
        .select()
        .from(users)
        .where(sql`UPPER(${users.username}) = ${studentCode}`)
        .limit(1);
      if (!stuUser) {
        [stuUser] = await db
          .insert(users)
          .values({
            username: studentCode,
            email: null,
            passwordHash: demoPasswordHash,
            fullName,
            role: 'STUDENT',
            phone: details.guardianPhone,
            avatarUrl: '/src/assets/images/avatar_student_1_1795235450731.jpg',
            isActive: true,
          })
          .returning();
      }

      const [newStudent] = await db
        .insert(students)
        .values({
          userId: stuUser.id,
          studentCode,
          fullName,
          classId: cls.id,
          rollNumber: roll,
          academicYearId: currentYear.id,
          admissionDate: '2026-04-02',
          avatarUrl: '/src/assets/images/avatar_student_1_1795235450731.jpg',
          isActive: true,
          ...details,
        })
        .returning();

      allStudents.push(newStudent);
      classStudents.push(newStudent);
      usedRolls.add(roll);
      existingStudentCodes.add(studentCode);

      // Parent user account & link
      const parentCode = `PAR-${studentCode.replace(/^STU-/, '')}`;
      let [parUser] = await db
        .select()
        .from(users)
        .where(sql`UPPER(${users.username}) = ${parentCode}`)
        .limit(1);
      if (!parUser) {
        [parUser] = await db
          .insert(users)
          .values({
            username: parentCode,
            email: null,
            passwordHash: demoPasswordHash,
            fullName: roll % 2 === 1 ? details.fatherName : details.motherName,
            role: 'PARENT',
            phone: details.guardianPhone,
            avatarUrl: '/src/assets/images/avatar_parent_1_1795235450625.jpg',
            isActive: true,
          })
          .returning();
      }

      await db.insert(parentStudentLinks).values({
        parentId: parUser.id,
        studentId: newStudent.id,
        relationship: roll % 2 === 1 ? 'Father' : 'Mother',
        isPrimary: true,
      });
    }
  }

  // 10. Regulated Exams (Global Unit Test 1 & Mid-Term + Class-specific Term 2 upcoming exams)
  let allExams = await db.select().from(exams);
  let unitTestExam = allExams.find((e) => e.name === 'Unit Test 1');
  if (!unitTestExam) {
    [unitTestExam] = await db
      .insert(exams)
      .values({
        name: 'Unit Test 1',
        examGroup: 'Unit Test 1 (Aug 2026)',
        academicYearId: currentYear.id,
        classId: null,
        subjectId: null,
        examDate: '2026-08-18',
        startTime: '09:00 AM',
        durationMinutes: 90,
        maxMarks: 100,
        room: 'Classroom',
        createdById: adminUser.id,
      })
      .returning();
  }

  let midTermExam = allExams.find((e) => e.name === 'Mid-Term Examination');
  if (!midTermExam) {
    [midTermExam] = await db
      .insert(exams)
      .values({
        name: 'Mid-Term Examination',
        examGroup: 'Mid-Term 2026',
        academicYearId: currentYear.id,
        classId: null,
        subjectId: null,
        examDate: '2026-10-12',
        startTime: '09:00 AM',
        durationMinutes: 180,
        maxMarks: 100,
        room: 'Main Exam Hall',
        createdById: adminUser.id,
      })
      .returning();
  }

  allExams = await db.select().from(exams);
  const classExamKeys = new Set(
    allExams.filter((e) => e.classId && e.subjectId).map((e) => `${e.classId}:${e.subjectId}`)
  );
  const upcomingSubjects = [mathSub, phySub, engSub, sstSub];
  const upcomingDates = ['2026-11-28', '2026-12-01', '2026-12-03', '2026-12-05'];

  for (const cls of allClasses) {
    for (let i = 0; i < upcomingSubjects.length; i++) {
      const sub = upcomingSubjects[i];
      if (!sub) continue;
      const key = `${cls.id}:${sub.id}`;
      if (!classExamKeys.has(key)) {
        await db.insert(exams).values({
          name: `Term 2 ${sub.name} (${cls.name}-${cls.section})`,
          examGroup: 'Term 2 Assessments (Nov-Dec 2026)',
          academicYearId: currentYear.id,
          classId: cls.id,
          subjectId: sub.id,
          examDate: upcomingDates[i],
          startTime: '09:00 AM',
          durationMinutes: 180,
          maxMarks: 100,
          room: `Room ${cls.roomNumber || '201'}`,
          createdById: cls.classTeacherId || adminUser.id,
        });
        classExamKeys.add(key);
      }
    }
  }

  // 11. Marks across Unit Test 1 & Mid-Term for EVERY student across core subjects
  const existingMarks = await db
    .select({
      studentId: marks.studentId,
      subjectId: marks.subjectId,
      examId: marks.examId,
    })
    .from(marks);
  const markKeySet = new Set(
    existingMarks.map((m) => `${m.studentId}:${m.subjectId}:${m.examId}`)
  );

  const gradedSubjects = existingSubjects.slice(0, 6);
  const markInserts: Array<{
    studentId: number;
    subjectId: number;
    examId: number;
    classId: number;
    obtainedMarks: number;
    maxMarks: number;
    grade: string;
    teacherRemark: string;
    uploadedById: number;
  }> = [];

  const classTeacherMap = new Map(allClasses.map((c) => [c.id, c.classTeacherId || allTeachers[0].id]));

  allStudents.forEach((stu, sIdx) => {
    const uploaderId = classTeacherMap.get(stu.classId) || allTeachers[0].id;
    gradedSubjects.forEach((sub, subIdx) => {
      const utScore = 69 + ((sIdx * 7 + subIdx * 11 + stu.rollNumber * 3) % 27);
      const midScore = Math.min(98, utScore + 2 + ((sIdx + subIdx) % 5));

      if (!markKeySet.has(`${stu.id}:${sub.id}:${unitTestExam!.id}`)) {
        markInserts.push({
          studentId: stu.id,
          subjectId: sub.id,
          examId: unitTestExam!.id,
          classId: stu.classId,
          obtainedMarks: utScore,
          maxMarks: 100,
          grade: computeGrade(utScore, 100),
          teacherRemark:
            utScore >= 85
              ? 'Strong analytical foundation and neat presentation.'
              : 'Steady progress; continue practicing problem sets.',
          uploadedById: uploaderId,
        });
        markKeySet.add(`${stu.id}:${sub.id}:${unitTestExam!.id}`);
      }

      if (!markKeySet.has(`${stu.id}:${sub.id}:${midTermExam!.id}`)) {
        markInserts.push({
          studentId: stu.id,
          subjectId: sub.id,
          examId: midTermExam!.id,
          classId: stu.classId,
          obtainedMarks: midScore,
          maxMarks: 100,
          grade: computeGrade(midScore, 100),
          teacherRemark:
            midScore >= 90
              ? 'Outstanding conceptual clarity and accuracy.'
              : midScore >= 80
                ? 'Consistent improvement over Unit Test 1.'
                : 'Review core definitions and solved textbook examples.',
          uploadedById: uploaderId,
        });
        markKeySet.add(`${stu.id}:${sub.id}:${midTermExam!.id}`);
      }
    });
  });

  for (let i = 0; i < markInserts.length; i += 250) {
    await db.insert(marks).values(markInserts.slice(i, i + 250));
  }

  // 12. Attendance for Nov 2026 (15 school days + 2 holidays) for EVERY student
  const novDates = [
    '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
    '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13',
    '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20',
  ];
  const holidayDates = ['2026-11-08', '2026-11-14'];

  const existingAtt = await db
    .select({ studentId: attendance.studentId, date: attendance.date })
    .from(attendance);
  const attKeySet = new Set(existingAtt.map((a) => `${a.studentId}:${a.date}`));
  const attInserts: Array<{
    studentId: number;
    classId: number;
    date: string;
    status: string;
    note: string | null;
    recordedById: number;
  }> = [];

  for (const stu of allStudents) {
    const recorderId = classTeacherMap.get(stu.classId) || allTeachers[0].id;
    for (let dIdx = 0; dIdx < novDates.length; dIdx++) {
      const d = novDates[dIdx];
      if (attKeySet.has(`${stu.id}:${d}`)) continue;
      let status = 'PRESENT';
      let note: string | null = null;
      const mod = (stu.id + dIdx) % 17;
      if (mod === 0) {
        status = 'ABSENT';
        note = 'Medical leave submitted by parent';
      } else if (mod === 7) {
        status = 'LATE';
        note = 'Arrived 10 mins after morning assembly';
      } else if (mod === 12) {
        status = 'EXCUSED';
        note = 'Represented school in inter-house quiz';
      }
      attInserts.push({
        studentId: stu.id,
        classId: stu.classId,
        date: d,
        status,
        note,
        recordedById: recorderId,
      });
    }

    for (const hd of holidayDates) {
      if (attKeySet.has(`${stu.id}:${hd}`)) continue;
      attInserts.push({
        studentId: stu.id,
        classId: stu.classId,
        date: hd,
        status: 'HOLIDAY',
        note: hd === '2026-11-14' ? 'Children’s Day Celebration Holiday' : 'Scheduled School Break',
        recordedById: adminUser.id,
      });
    }
  }

  for (let i = 0; i < attInserts.length; i += 300) {
    await db.insert(attendance).values(attInserts.slice(i, i + 300));
  }

  // 13. Homework for EVERY class
  const existingHw = await db.select({ classId: homework.classId }).from(homework);
  const hwClassSet = new Set(existingHw.map((h) => h.classId));
  for (const cls of allClasses) {
    if (hwClassSet.has(cls.id)) continue;
    const teacherId = cls.classTeacherId || allTeachers[0].id;
    await db.insert(homework).values([
      {
        title: `${cls.name} (${cls.section}) — Problem Solving Worksheet`,
        description: `Solve Exercises 1–10 in your fair notebook and highlight key formula derivations for ${cls.name}-${cls.section}.`,
        classId: cls.id,
        subjectId: mathSub.id,
        teacherId,
        dueDate: '2026-11-28',
        priority: 'HIGH',
        attachmentName: 'Quadratic_Worksheet_Ch4.txt',
        attachmentUrl: '/api/files/sample/Quadratic_Worksheet_Ch4.txt',
      },
      {
        title: `${cls.name} (${cls.section}) — Science Practical & Circuit Diagrams`,
        description: 'Draw labeled experimental apparatus diagrams and complete observation tables.',
        classId: cls.id,
        subjectId: phySub.id,
        teacherId,
        dueDate: '2026-11-30',
        priority: 'MEDIUM',
        attachmentName: 'Physics_Circuits_Guide.txt',
        attachmentUrl: '/api/files/sample/Physics_Circuits_Guide.txt',
      },
      {
        title: `${cls.name} (${cls.section}) — Structured Comprehension Essay`,
        description: 'Write a 350-word analytical essay on sustainable campus water conservation.',
        classId: cls.id,
        subjectId: engSub.id,
        teacherId,
        dueDate: '2026-12-02',
        priority: 'MEDIUM',
      },
    ]);
  }

  // 14. Assignments for EVERY class
  const existingAsg = await db.select({ classId: assignments.classId }).from(assignments);
  const asgClassSet = new Set(existingAsg.map((a) => a.classId));
  for (const cls of allClasses) {
    if (asgClassSet.has(cls.id)) continue;
    const teacherId = cls.classTeacherId || allTeachers[0].id;
    await db.insert(assignments).values([
      {
        title: `Applied Mathematics Project — ${cls.name}-${cls.section}`,
        description: 'Prepare a structured project file with real-world geometry measurements and graphs.',
        classId: cls.id,
        subjectId: mathSub.id,
        teacherId,
        dueDate: '2026-12-04',
        maxScore: 25,
        status: 'OPEN',
      },
      {
        title: `STEM & Coding Portfolio — ${cls.name}-${cls.section}`,
        description: 'Document lab exercises and algorithmic flowcharts for Term 2 practical review.',
        classId: cls.id,
        subjectId: csSub.id,
        teacherId,
        dueDate: '2026-12-08',
        maxScore: 30,
        status: 'OPEN',
      },
    ]);
  }

  // 15. Digital Study Notes Library for EVERY class
  const existingNotes = await db.select({ classId: notes.classId }).from(notes);
  const notesClassSet = new Set(existingNotes.map((n) => n.classId));
  for (const cls of allClasses) {
    if (notesClassSet.has(cls.id)) continue;
    const teacherId = cls.classTeacherId || allTeachers[0].id;
    await db.insert(notes).values([
      {
        title: `${cls.name}-${cls.section} Physics — Concept & Numericals Guide`,
        chapter: 'Core Concepts & Laws',
        topic: 'Derivations & Solved Board Examples',
        content: 'Comprehensive chapter summary with formulas, SI units, and solved practice problems.',
        classId: cls.id,
        subjectId: phySub.id,
        teacherId,
        academicYearId: currentYear.id,
        fileName: 'Physics_Electricity_Notes.txt',
        fileType: 'PDF / Study Guide',
        fileSizeBytes: 248500,
        fileUrl: '/api/files/sample/Physics_Electricity_Notes.txt',
      },
      {
        title: `${cls.name}-${cls.section} Mathematics — Formula Revision Sheet`,
        chapter: 'Algebra & Geometry Reference',
        topic: 'Standard Identities & Theorems',
        content: 'Quick-revision formula sheet designed for unit tests and term examinations.',
        classId: cls.id,
        subjectId: mathSub.id,
        teacherId,
        academicYearId: currentYear.id,
        fileName: 'Math_Quadratic_Formula_Sheet.txt',
        fileType: 'PDF / Formula Sheet',
        fileSizeBytes: 184200,
        fileUrl: '/api/files/sample/Math_Quadratic_Formula_Sheet.txt',
      },
      {
        title: `${cls.name}-${cls.section} Social Science — Historical Timeline`,
        chapter: 'Modern Indian History',
        topic: 'Key Constitutional & National Milestones',
        content: 'Chronological reference sheet for classroom review and quiz prep.',
        classId: cls.id,
        subjectId: sstSub.id,
        teacherId,
        academicYearId: currentYear.id,
        fileName: 'History_Timeline_Deck.txt',
        fileType: 'PPTX / Lecture Deck',
        fileSizeBytes: 512000,
        fileUrl: '/api/files/sample/History_Timeline_Deck.txt',
      },
    ]);
  }

  // 16. Teacher Remarks for top students in EVERY class
  const existingRemarks = await db.select({ studentId: teacherRemarks.studentId }).from(teacherRemarks);
  const remarkStudentSet = new Set(existingRemarks.map((r) => r.studentId));
  const remarkInserts: Array<{
    studentId: number;
    teacherId: number;
    subjectId: number;
    remark: string;
    category: string;
  }> = [];

  for (const cls of allClasses) {
    const teacherId = cls.classTeacherId || allTeachers[0].id;
    const classStudents = allStudents
      .filter((s) => s.classId === cls.id)
      .sort((a, b) => a.rollNumber - b.rollNumber)
      .slice(0, 3);
    for (const stu of classStudents) {
      if (remarkStudentSet.has(stu.id)) continue;
      remarkInserts.push({
        studentId: stu.id,
        teacherId,
        subjectId: mathSub.id,
        remark: `${stu.fullName} demonstrates consistent discipline, neat classwork, and strong conceptual growth in ${cls.name}-${cls.section}.`,
        category: 'PROGRESS',
      });
      remarkStudentSet.add(stu.id);
    }
  }
  if (remarkInserts.length > 0) {
    await db.insert(teacherRemarks).values(remarkInserts);
  }

  // 17. Class Timetables (Mon - Sat) for EVERY class missing timetable rows
  const existingTT = await db.select({ classId: classTimetables.classId }).from(classTimetables);
  const ttClassSet = new Set(existingTT.map((t) => t.classId));
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const periodSlots = [
    { periodNumber: 1, startTime: '08:30 AM', endTime: '09:15 AM' },
    { periodNumber: 2, startTime: '09:20 AM', endTime: '10:05 AM' },
    { periodNumber: 3, startTime: '10:25 AM', endTime: '11:10 AM' },
    { periodNumber: 4, startTime: '11:15 AM', endTime: '12:00 PM' },
    { periodNumber: 5, startTime: '12:40 PM', endTime: '01:25 PM' },
    { periodNumber: 6, startTime: '01:30 PM', endTime: '02:15 PM' },
  ];

  const ttInserts: Array<{
    classId: number;
    dayOfWeek: string;
    periodNumber: number;
    startTime: string;
    endTime: string;
    subjectId: number;
    teacherId: number;
    room: string;
  }> = [];

  for (const cls of allClasses) {
    if (ttClassSet.has(cls.id)) continue;
    days.forEach((day, dIdx) => {
      const slotsForDay = day === 'SAT' ? periodSlots.slice(0, 4) : periodSlots;
      slotsForDay.forEach((slot, pIdx) => {
        const sub = existingSubjects[(dIdx + pIdx) % existingSubjects.length];
        const teacher =
          pIdx === 0 && cls.classTeacherId
            ? { id: cls.classTeacherId }
            : allTeachers[(dIdx + pIdx) % allTeachers.length];
        ttInserts.push({
          classId: cls.id,
          dayOfWeek: day,
          periodNumber: slot.periodNumber,
          startTime: slot.startTime,
          endTime: slot.endTime,
          subjectId: sub.id,
          teacherId: teacher.id,
          room:
            sub.code === 'CS'
              ? 'CS Lab 1'
              : sub.code === 'PHY' || sub.code === 'CHEM' || sub.code === 'BIO'
                ? 'Science Lab'
                : `Room ${cls.roomNumber || '201'}`,
        });
      });
    });
  }
  for (let i = 0; i < ttInserts.length; i += 200) {
    await db.insert(classTimetables).values(ttInserts.slice(i, i + 200));
  }

  // 18. Fee Records for EVERY student missing fee rows
  const existingFees = await db.select({ studentId: feeRecords.studentId }).from(feeRecords);
  const feeStudentSet = new Set(existingFees.map((f) => f.studentId));
  const feeInserts: Array<{
    studentId: number;
    title: string;
    category: string;
    amount: number;
    dueDate: string;
    paidDate: string | null;
    status: string;
    receiptNo: string | null;
    academicYearId: number;
  }> = [];

  allStudents.forEach((stu, idx) => {
    if (feeStudentSet.has(stu.id)) return;
    feeInserts.push(
      {
        studentId: stu.id,
        title: 'Term 1 Tuition & Academic Fee',
        category: 'TUITION',
        amount: 18500,
        dueDate: '2026-07-15',
        paidDate: '2026-07-10',
        status: 'PAID',
        receiptNo: `MVA-2026-${String(1001 + idx)}`,
        academicYearId: currentYear.id,
      },
      {
        studentId: stu.id,
        title: 'Annual Science & Robotics Lab Fee',
        category: 'LAB',
        amount: 3200,
        dueDate: '2026-09-10',
        paidDate: idx % 5 === 0 ? null : '2026-09-05',
        status: idx % 5 === 0 ? 'OVERDUE' : 'PAID',
        receiptNo: idx % 5 === 0 ? null : `MVA-2026-${String(2001 + idx)}`,
        academicYearId: currentYear.id,
      },
      {
        studentId: stu.id,
        title: 'Term 2 Tuition & Exam Fee',
        category: 'EXAM',
        amount: 19000,
        dueDate: '2026-12-05',
        paidDate: null,
        status: 'PENDING',
        receiptNo: null,
        academicYearId: currentYear.id,
      },
      {
        studentId: stu.id,
        title: 'School Bus Transport — Q3',
        category: 'TRANSPORT',
        amount: 4500,
        dueDate: '2026-11-30',
        paidDate: idx % 3 === 0 ? null : '2026-11-12',
        status: idx % 3 === 0 ? 'PENDING' : 'PAID',
        receiptNo: idx % 3 === 0 ? null : `MVA-2026-${String(3001 + idx)}`,
        academicYearId: currentYear.id,
      }
    );
  });
  for (let i = 0; i < feeInserts.length; i += 250) {
    await db.insert(feeRecords).values(feeInserts.slice(i, i + 250));
  }

  // 19. School Notices
  const [{ value: noticeCount }] = await db.select({ value: count() }).from(notices);
  if (Number(noticeCount) === 0) {
    await db.insert(notices).values([
      {
        title: 'Parent–Teacher Meeting (PTM) — Term 1 Progress Review',
        description: 'Parents of Classes 6 to 10 are invited for individual academic consultations on Saturday, 28 November 2026 from 9:00 AM to 1:30 PM at Macro Vision Academy Burhanpur.',
        category: 'PTM',
        priority: 'IMPORTANT',
        isPinned: true,
        targetRole: 'ALL',
        authorId: adminUser.id,
        expiryDate: '2026-11-30',
      },
      {
        title: 'Term 2 Examination Timetable Released',
        description: 'The Term 2 assessment timetable for Classes 6–10 is now published. Students must report 20 minutes before the 9:00 AM exam bell.',
        category: 'EXAM',
        priority: 'URGENT',
        isPinned: true,
        targetRole: 'ALL',
        authorId: adminUser.id,
        expiryDate: '2026-12-15',
      },
      {
        title: 'Annual Science & Robotics Exhibition Registration',
        description: 'Students presenting STEM models for the December exhibition should submit team lists to their class teacher.',
        category: 'EVENT',
        priority: 'NORMAL',
        isPinned: false,
        targetRole: 'ALL',
        authorId: allTeachers[0].id,
      },
      {
        title: 'Winter Uniform Transition Notice',
        description: 'All students are requested to wear the full winter blazer uniform during morning assembly.',
        category: 'ANNOUNCEMENT',
        priority: 'NORMAL',
        targetRole: 'PARENT',
        authorId: adminUser.id,
      },
    ]);
  }

  // 20. School Calendar Events
  const [{ value: eventCount }] = await db.select({ value: count() }).from(schoolEvents);
  if (Number(eventCount) === 0) {
    await db.insert(schoolEvents).values([
      {
        title: 'Parent–Teacher Meeting (PTM)',
        description: 'Individual progress review slots with homeroom and subject faculty.',
        eventType: 'PTM',
        eventDate: '2026-11-28',
        startTime: '09:00 AM',
        location: 'Respective Classrooms',
        createdById: adminUser.id,
      },
      {
        title: 'Term 2 Mathematics Exam',
        description: '3-hour written assessment across Classes 6–10.',
        eventType: 'EXAM',
        eventDate: '2026-11-28',
        startTime: '09:00 AM',
        location: 'Main Academic Block',
        createdById: adminUser.id,
      },
      {
        title: 'Inter-House Mathematics Olympiad',
        description: 'School-wide problem solving competition for Grades 6–10.',
        eventType: 'COMPETITION',
        eventDate: '2026-12-03',
        startTime: '10:30 AM',
        location: 'MVA Auditorium',
        createdById: allTeachers[0].id,
      },
      {
        title: 'Winter Cultural & Science Showcase',
        description: 'Annual student exhibition and parent showcase.',
        eventType: 'EVENT',
        eventDate: '2026-12-12',
        startTime: '10:00 AM',
        location: 'Main Campus Courtyard',
        createdById: adminUser.id,
      },
      {
        title: 'Winter Break Begins',
        description: 'School closed for winter recess.',
        eventType: 'HOLIDAY',
        eventDate: '2026-12-24',
        startTime: 'All Day',
        location: 'Campus Closed',
        createdById: adminUser.id,
      },
    ]);
  }

  // 21. Campus Gallery Items
  const [{ value: galleryCount }] = await db.select({ value: count() }).from(galleryItems);
  if (Number(galleryCount) === 0) {
    await db.insert(galleryItems).values([
      {
        title: 'Annual Science & Robotics Exhibition 2026',
        description:
          'Students showcased solar micro-grids, autonomous rovers, and clean-water filtration prototypes in the main auditorium.',
        albumName: 'Science & Robotics',
        eventDate: '2026-11-14',
        imageUrl: '/src/assets/images/gallery_science_fair_1795258860582.jpg',
        postedById: adminUser.id,
      },
      {
        title: 'Inter-House Annual Athletics & Sports Meet',
        description:
          'Track relays, march-past parade, and championship trophy ceremony on the Macro Vision sports ground.',
        albumName: 'Sports Meet',
        eventDate: '2026-11-07',
        imageUrl: '/src/assets/images/gallery_sports_day_1795258859902.jpg',
        postedById: adminUser.id,
      },
      {
        title: 'STEM & Coding Lab Showcase',
        description:
          'Computer Science teams demonstrating Python algorithmic projects and smart campus sensors during Open House.',
        albumName: 'STEM & Labs',
        eventDate: '2026-10-28',
        imageUrl: '/src/assets/images/gallery_computer_lab_1795258859982.jpg',
        postedById: allTeachers[0].id,
      },
    ]);
  }

  // 22. Sample Parent <-> Teacher Messages & Notifications & Audit Log
  const [{ value: msgCount }] = await db.select({ value: count() }).from(messages);
  if (Number(msgCount) === 0 && allStudents.length > 0) {
    const firstStu = allStudents[0];
    const [firstLink] = await db
      .select()
      .from(parentStudentLinks)
      .where(eq(parentStudentLinks.studentId, firstStu.id))
      .limit(1);
    const clsTeacherId = classTeacherMap.get(firstStu.classId) || allTeachers[0].id;
    if (firstLink) {
      await db.insert(messages).values([
        {
          senderId: clsTeacherId,
          recipientId: firstLink.parentId,
          studentId: firstStu.id,
          subject: `${firstStu.fullName} — Mid-Term Academic Progress`,
          body: `Dear Parent, ${firstStu.fullName} has shown steady improvement in Mid-Term assessments. Let us connect during the upcoming PTM on Saturday.`,
          isRead: false,
        },
        {
          senderId: firstLink.parentId,
          recipientId: clsTeacherId,
          studentId: firstStu.id,
          subject: `Re: ${firstStu.fullName} — Mid-Term Academic Progress`,
          body: 'Thank you for the update! We look forward to meeting you at the PTM.',
          isRead: true,
        },
      ]);
    }
  }

  const [{ value: notifCount }] = await db.select({ value: count() }).from(notifications);
  if (Number(notifCount) === 0) {
    const notifInserts = allTeachers.slice(0, 5).map((t) => ({
      userId: t.id,
      title: 'Class Roster & Term 2 Schedule Ready',
      message: 'Your assigned homeroom class roster, marks ledger, and Term 2 timetable are ready.',
      type: 'NOTICE',
      linkTab: 'class-students',
      isRead: false,
    }));
    await db.insert(notifications).values(notifInserts);
  }

  const [{ value: logCount }] = await db.select({ value: count() }).from(auditLogs);
  if (Number(logCount) < 3) {
    await db.insert(auditLogs).values([
      {
        actorId: adminUser.id,
        actorName: adminUser.fullName,
        actorRole: 'ADMIN',
        action: 'SYNC_DEMO_DIRECTORY',
        entityType: 'school',
        entityId: '1',
        details: 'Initialized regulated demo data across all teachers, homeroom classes, students, parents, marks, attendance, timetables, and fees.',
      },
    ]);
  }

  const [{ value: finalParents }] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.role, 'PARENT'));
  const [{ value: finalMarks }] = await db.select({ value: count() }).from(marks);
  const [{ value: finalAtt }] = await db.select({ value: count() }).from(attendance);

  return {
    teachers: allTeachers.length,
    classes: allClasses.length,
    students: allStudents.length,
    parents: Number(finalParents),
    marks: Number(finalMarks),
    attendance: Number(finalAtt),
  };
}
