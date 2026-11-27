import { Server as HttpServer } from 'node:http';
import {
  FunctionDeclaration,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Type,
} from '@google/genai';
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { db } from '../db/index.ts';
import {
  classes,
  exams,
  feeRecords,
  homework,
  marks,
  notices,
  parentStudentLinks,
  students,
  subjects,
  users,
} from '../db/schema.ts';
import { verifySessionToken } from '../utils/security.ts';

interface TabDefinition {
  id: string;
  label: string;
  description: string;
}

export interface AssistantNavAction {
  tabId: string;
  tabLabel: string;
  searchQuery?: string;
  roleFilter?: 'ALL' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';
}

const ADMIN_TABS: TabDefinition[] = [
  { id: 'overview', label: 'Overview', description: 'School-wide stats, quick actions, class counts, recent activity' },
  { id: 'classes', label: 'Classes & Teachers', description: 'Create/edit/delete classes, assign 1 class teacher per class, subjects, subject teacher assignments' },
  { id: 'students', label: 'Student Enrollment', description: 'Enroll new students, search/filter student records, edit or delete student details' },
  { id: 'parents', label: 'Parent Enrollment', description: 'Enroll parent accounts, link parents to children, edit/delete parent accounts' },
  { id: 'users', label: 'Faculty & Accounts', description: 'Manage, create, edit, reset password, disable, or delete Teacher, Parent, and Student accounts' },
  { id: 'activity', label: 'Activity Logs', description: 'Search and audit all portal activity logs' },
  { id: 'timetable', label: 'Class Timetable', description: 'View and manage weekly class period timetables' },
  { id: 'fees', label: 'Fee Management', description: 'View student fee ledger and issue fee invoices' },
  { id: 'notices', label: 'Notice Board', description: 'Publish, pin, or delete school notices and announcements' },
  { id: 'gallery', label: 'Campus Gallery', description: 'Campus photo albums and event gallery' },
  { id: 'calendar', label: 'School Calendar', description: 'School holidays, PTM, and academic events calendar' },
  { id: 'branding', label: 'School Branding', description: 'Configure school name, academic year, email, phone, address, and theme colors' },
];

const TEACHER_TABS: TabDefinition[] = [
  { id: 'overview', label: 'Teacher Home', description: 'Assigned homeroom class overview, live marks, upcoming homework, recent attendance' },
  { id: 'class-students', label: 'Class Students', description: 'Assigned homeroom students roster, open student account/portal, edit student details' },
  { id: 'marks', label: 'Marks & CSV', description: 'Enter individual marks, upload CSV/Excel marks, create exams' },
  { id: 'teacher-attendance', label: 'Attendance', description: 'Record daily attendance for assigned class' },
  { id: 'timetable', label: 'Class Timetable', description: 'Weekly period timetable' },
  { id: 'homework', label: 'Homework', description: 'Post homework and assignments' },
  { id: 'notes', label: 'Notes Library', description: 'Upload and manage chapter study notes/PDFs' },
  { id: 'exams', label: 'Exam Timetable', description: 'Upcoming exam dates, times, and rooms' },
  { id: 'notices', label: 'Notice Board', description: 'School announcements and teacher notices' },
  { id: 'gallery', label: 'Campus Gallery', description: 'School photo albums' },
  { id: 'calendar', label: 'School Calendar', description: 'Academic calendar events and holidays' },
  { id: 'messages', label: 'Parent Messages', description: 'Message parents directly' },
];

const PARENT_TABS: TabDefinition[] = [
  { id: 'overview', label: 'Home', description: 'Child academic summary, notices, and quick overview' },
  { id: 'academics', label: 'Performance', description: 'Marks, grades, subject performance charts, and teacher remarks' },
  { id: 'attendance', label: 'Attendance', description: 'Attendance calendar and monthly presence records' },
  { id: 'timetable', label: 'Class Timetable', description: 'Weekly class timetable' },
  { id: 'homework', label: 'Homework', description: 'Upcoming homework and assignments' },
  { id: 'notes', label: 'Notes Library', description: 'Download study notes and guides' },
  { id: 'exams', label: 'Exam Timetable', description: 'Upcoming exam schedule' },
  { id: 'fees', label: 'Fee Status', description: 'View fee invoices, pay fees, and download receipts' },
  { id: 'notices', label: 'Notice Board', description: 'School notices and circulars' },
  { id: 'gallery', label: 'Campus Gallery', description: 'School photo gallery' },
  { id: 'calendar', label: 'School Calendar', description: 'School events and holidays' },
  { id: 'messages', label: 'Messages', description: 'Messages with teachers' },
  { id: 'profile', label: 'Student Profile', description: 'Detailed student profile and guardian info' },
];

const STUDENT_TABS: TabDefinition[] = PARENT_TABS.filter((t) => t.id !== 'messages');

function getAllowedTabsForRole(role?: string): TabDefinition[] {
  switch (role) {
    case 'ADMIN':
      return ADMIN_TABS;
    case 'TEACHER':
      return TEACHER_TABS;
    case 'PARENT':
      return PARENT_TABS;
    case 'STUDENT':
      return STUDENT_TABS;
    default:
      return [];
  }
}

function validateNavigationAction(
  role: string | undefined,
  raw?: { tabId?: string; searchQuery?: string | null; roleFilter?: string | null } | null
): AssistantNavAction | null {
  if (!raw?.tabId) return null;
  const allowed = getAllowedTabsForRole(role);
  const match = allowed.find((t) => t.id === raw.tabId);
  if (!match) return null;

  const validRoles = new Set(['ALL', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT']);
  const cleanRole =
    raw.roleFilter && validRoles.has(raw.roleFilter.toUpperCase())
      ? (raw.roleFilter.toUpperCase() as AssistantNavAction['roleFilter'])
      : undefined;

  return {
    tabId: match.id,
    tabLabel: match.label,
    ...(raw.searchQuery && raw.searchQuery.trim()
      ? { searchQuery: raw.searchQuery.trim() }
      : {}),
    ...(cleanRole ? { roleFilter: cleanRole } : {}),
  };
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ResolvedUserContext {
  id: number;
  fullName: string;
  role: string;
}

async function resolveUserContext(token?: string | null): Promise<ResolvedUserContext | null> {
  if (!token) return null;
  try {
    const session = verifySessionToken(token);
    if (!session) return null;
    const [dbUser] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!dbUser || !dbUser.isActive) return null;
    return { id: dbUser.id, fullName: dbUser.fullName, role: dbUser.role };
  } catch {
    return null;
  }
}

async function fetchAuthorizedPortalSnippet(
  userContext: ResolvedUserContext | null,
  queryText: string
): Promise<string> {
  if (!userContext) return '';
  const tokens = queryText
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !/^(go|to|open|show|find|search|for|the|my|me|in|on|of|is|are|what|where|how|why|can|you|page|tab|please|error|fix)$/i.test(w))
    .slice(0, 3);
  const keyword = tokens[0] ? `%${tokens[0]}%` : null;

  try {
    const lines: string[] = [];

    if (userContext.role === 'ADMIN') {
      const clsRows = await db
        .select({ name: classes.name, section: classes.section, teacher: users.fullName })
        .from(classes)
        .leftJoin(users, eq(classes.classTeacherId, users.id))
        .limit(12);
      if (clsRows.length > 0) {
        lines.push(
          `School Classes: ${clsRows.map((c) => `${c.name}-${c.section} (Class Teacher: ${c.teacher || 'Unassigned'})`).join('; ')}`
        );
      }

      if (keyword) {
        const matchedStudents = await db
          .select({
            fullName: students.fullName,
            studentCode: students.studentCode,
            className: classes.name,
            section: classes.section,
          })
          .from(students)
          .innerJoin(classes, eq(students.classId, classes.id))
          .where(or(ilike(students.fullName, keyword), ilike(students.studentCode, keyword)))
          .limit(6);
        if (matchedStudents.length > 0) {
          lines.push(
            `Matching Students: ${matchedStudents.map((s) => `${s.fullName} (${s.studentCode}, ${s.className}-${s.section})`).join('; ')}`
          );
        }

        const matchedUsers = await db
          .select({ fullName: users.fullName, username: users.username, role: users.role })
          .from(users)
          .where(or(ilike(users.fullName, keyword), ilike(users.username, keyword)))
          .limit(6);
        if (matchedUsers.length > 0) {
          lines.push(
            `Matching Accounts: ${matchedUsers.map((u) => `${u.fullName} (${u.username || 'N/A'}, ${u.role})`).join('; ')}`
          );
        }
      }
    } else if (userContext.role === 'TEACHER') {
      const homerooms = await db
        .select({ id: classes.id, name: classes.name, section: classes.section })
        .from(classes)
        .where(eq(classes.classTeacherId, userContext.id));
      if (homerooms.length > 0) {
        lines.push(
          `Assigned Homeroom Class: ${homerooms.map((c) => `${c.name}-${c.section}`).join(', ')}`
        );
        const stuQuery = db
          .select({
            fullName: students.fullName,
            studentCode: students.studentCode,
            rollNumber: students.rollNumber,
          })
          .from(students)
          .where(
            keyword
              ? and(
                  inArray(students.classId, homerooms.map((c) => c.id)),
                  or(ilike(students.fullName, keyword), ilike(students.studentCode, keyword))
                )
              : inArray(students.classId, homerooms.map((c) => c.id))
          )
          .limit(8);
        const classStudents = await stuQuery;
        if (classStudents.length > 0) {
          lines.push(
            `Homeroom Students: ${classStudents.map((s) => `${s.fullName} (${s.studentCode}, Roll #${s.rollNumber})`).join('; ')}`
          );
        }
      } else {
        lines.push('Assigned Homeroom Class: None assigned yet by Admin.');
      }
    } else if (userContext.role === 'PARENT' || userContext.role === 'STUDENT') {
      const studentRows =
        userContext.role === 'PARENT'
          ? await db
              .select({
                id: students.id,
                fullName: students.fullName,
                studentCode: students.studentCode,
                classId: students.classId,
                className: classes.name,
                section: classes.section,
              })
              .from(parentStudentLinks)
              .innerJoin(students, eq(parentStudentLinks.studentId, students.id))
              .innerJoin(classes, eq(students.classId, classes.id))
              .where(eq(parentStudentLinks.parentId, userContext.id))
          : await db
              .select({
                id: students.id,
                fullName: students.fullName,
                studentCode: students.studentCode,
                classId: students.classId,
                className: classes.name,
                section: classes.section,
              })
              .from(students)
              .innerJoin(classes, eq(students.classId, classes.id))
              .where(eq(students.userId, userContext.id));

      if (studentRows.length > 0) {
        lines.push(
          `Student Record(s): ${studentRows.map((s) => `${s.fullName} (${s.studentCode}, ${s.className}-${s.section})`).join('; ')}`
        );
        const firstStu = studentRows[0];
        const [recentMarks, pendingFees, upcomingHw] = await Promise.all([
          db
            .select({
              subject: subjects.name,
              obtained: marks.obtainedMarks,
              max: marks.maxMarks,
              grade: marks.grade,
            })
            .from(marks)
            .innerJoin(subjects, eq(marks.subjectId, subjects.id))
            .where(eq(marks.studentId, firstStu.id))
            .orderBy(desc(marks.updatedAt))
            .limit(4),
          db
            .select({ title: feeRecords.title, amount: feeRecords.amount, status: feeRecords.status })
            .from(feeRecords)
            .where(eq(feeRecords.studentId, firstStu.id))
            .limit(4),
          db
            .select({ title: homework.title, dueDate: homework.dueDate, subject: subjects.name })
            .from(homework)
            .innerJoin(subjects, eq(homework.subjectId, subjects.id))
            .where(eq(homework.classId, firstStu.classId))
            .orderBy(desc(homework.dueDate))
            .limit(4),
        ]);
        if (recentMarks.length > 0) {
          lines.push(
            `Recent Marks (${firstStu.fullName}): ${recentMarks.map((m) => `${m.subject}: ${m.obtained}/${m.max} (${m.grade})`).join(', ')}`
          );
        }
        if (pendingFees.length > 0) {
          lines.push(
            `Fees: ${pendingFees.map((f) => `${f.title} Rs.${f.amount} [${f.status}]`).join(', ')}`
          );
        }
        if (upcomingHw.length > 0) {
          lines.push(
            `Homework: ${upcomingHw.map((h) => `${h.subject}: ${h.title} (Due ${h.dueDate})`).join(', ')}`
          );
        }
      }
    }

    const recentNotices = await db
      .select({ title: notices.title, category: notices.category })
      .from(notices)
      .orderBy(desc(notices.createdAt))
      .limit(3);
    if (recentNotices.length > 0) {
      lines.push(
        `Latest Notices: ${recentNotices.map((n) => `${n.title} [${n.category}]`).join('; ')}`
      );
    }

    const upcomingExams = await db
      .select({ name: exams.name, examDate: exams.examDate })
      .from(exams)
      .orderBy(desc(exams.examDate))
      .limit(3);
    if (upcomingExams.length > 0) {
      lines.push(
        `Exams: ${upcomingExams.map((e) => `${e.name} (${e.examDate})`).join('; ')}`
      );
    }

    return lines.join('\n');
  } catch (err) {
    console.error('Assistant snippet lookup skipped:', err);
    return '';
  }
}

function buildSystemInstruction(
  userContext: ResolvedUserContext | null,
  pageContext?: string,
  recentError?: { title?: string; message?: string; fieldLabel?: string; pageContext?: string } | null,
  portalSnippet?: string
): string {
  const roleLine = userContext
    ? `Current signed-in user: ${userContext.fullName} (Role: ${userContext.role}).`
    : 'Current user is on the Sign-In screen (not signed in yet).';

  const contextLine = pageContext ? `Active portal view: ${pageContext}.` : '';
  const allowedTabs = getAllowedTabsForRole(userContext?.role);
  const tabsGuide =
    allowedTabs.length > 0
      ? `Available navigation tabs for this user's role (${userContext!.role}):\n` +
        allowedTabs.map((t) => `- tabId="${t.id}" (${t.label}): ${t.description}`).join('\n')
      : 'User is not signed in yet, so navigation tabs are unavailable until they sign in with School ID & Password.';

  const errorBlock = recentError?.message
    ? `\nACTIVE FORM/ENTRY ERROR TO HELP SOLVE:\n- Screen: ${recentError.pageContext || pageContext || 'Portal'}\n- Field: ${recentError.fieldLabel || 'Form submission'}\n- Error Title: ${recentError.title || 'Entry Error'}\n- Exact Error Message: ${recentError.message}`
    : '';

  const snippetBlock = portalSnippet
    ? `\nAUTHORIZED LIVE PORTAL CONTEXT (for answering user queries accurately):\n${portalSnippet}`
    : '';

  return [
    'You are the smart AI Navigation, Query, and Troubleshooting Assistant for Macro Vision Academy Burhanpur.',
    roleLine,
    contextLine,
    tabsGuide,
    errorBlock,
    snippetBlock,
    'Core capabilities:',
    '1. AUTO-NAVIGATION & QUERY PICKING: Whenever the user asks to go to, open, view, search, filter, or find a section or record (e.g. "open student enrollment", "search Rajveer", "show teachers", "where do I upload marks", "check fees", "show physics notes"), pick the best matching tabId from the Available navigation tabs above AND extract any search/filter query (searchQuery) or account roleFilter (ALL, ADMIN, TEACHER, PARENT, STUDENT for users tab). Tell the user concisely that you directed them there.',
    '2. ENTRY & FORM ERROR SOLVER: Whenever the user encounters or describes an error entering information, explain clearly why it happened and give exact step-by-step instructions to fix it using the portal rules below (and navigate them to a prerequisite page if needed, e.g. creating a class before enrolling a student):',
    '   - School IDs / Usernames (Teachers like TCH-021, Parents like PAR-101, Students like STU-10A-001): Must be a School ID code without "@" (email addresses are rejected). Must be unique across accounts.',
    '   - Passwords: Minimum 8 characters required.',
    '   - Class Teacher Assignment: Each teacher can only manage ONE homeroom class (409 conflict if already assigned to another class — unassign them on the other class first or pick another teacher).',
    '   - Class Creation/Deletion: Class + Section must be unique for the current academic year. Deleting a class with enrolled students is blocked (409) until students are reassigned or deleted.',
    '   - Student Enrollment/Details: Full Name (min 2 chars), Student Code (min 3 chars, no "@"), Class, and Roll Number (positive integer) are required.',
    '   - Marks & CSV Upload: Class, Subject, and Exam must be selected first. Obtained marks must be between 0 and maxMarks. CSV rows must use Student ID and Marks columns.',
    '   - Subjects: Subject Name and Code must be unique. Subjects used by marks, homework, assignments, notes, or timetables cannot be deleted.',
    '   - Dates & Fees: Use YYYY-MM-DD format for dates; fee amounts must be positive whole numbers.',
    '   - Sign In: Users sign in with School ID / Username + Password. If locked/forgot password, contact Admin or use Admin > Faculty & Accounts.',
    '3. Keep responses concise, warm, plain-language, and practical (2-4 short sentences or short numbered fix steps). Never fabricate private records outside the authorized context.',
  ]
    .filter(Boolean)
    .join('\n');
}

const navigateToolDeclaration: FunctionDeclaration = {
  name: 'navigate_to_page',
  description:
    'Navigate the user directly to a matching page/tab in the Macro Vision Academy portal and optionally apply a search query or role filter.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tabId: {
        type: Type.STRING,
        description: 'Exact tabId from the Available navigation tabs list for the signed-in user role.',
      },
      searchQuery: {
        type: Type.STRING,
        description: 'Optional search term or name/ID/keyword to filter on that page (e.g. student name, subject, keyword).',
      },
      roleFilter: {
        type: Type.STRING,
        description: 'Optional role filter when tabId is "users": ALL, ADMIN, TEACHER, PARENT, or STUDENT.',
      },
    },
    required: ['tabId'],
  },
};

function sendWsJson(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function formatGeminiError(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err || 'Unknown Gemini API error');
  try {
    const parsed = JSON.parse(msg);
    if (parsed?.error?.message) {
      msg = String(parsed.error.message);
    }
  } catch {
    // plain string
  }
  if (/API_KEY_INVALID|PERMISSION_DENIED|403|400/.test(msg) && /key/i.test(msg)) {
    return 'Gemini API key is invalid or missing permissions. Please verify GEMINI_API_KEY in Settings > Secrets.';
  }
  if (/RESOURCE_EXHAUSTED|429/.test(msg)) {
    return 'Gemini API quota temporarily reached. Please try again in a moment or check billing in Settings > Secrets.';
  }
  if (/UNAVAILABLE|503|high demand/i.test(msg)) {
    return 'The AI service is momentarily busy due to high demand. Please try again in a few seconds.';
  }
  return msg;
}

export function attachLiveAssistantWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: '/ws/live-assistant',
  });

  wss.on('connection', (clientWs: WebSocket) => {
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isClosing = false;
    let initStarted = false;
    let sessionRole: string | undefined;

    const closeAll = () => {
      if (isClosing) return;
      isClosing = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore close errors
        }
        liveSession = null;
      }
      if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
        clientWs.close();
      }
    };

    const startLiveSession = async (
      token?: string | null,
      pageContext?: string,
      recentError?: { title?: string; message?: string; fieldLabel?: string; pageContext?: string } | null
    ) => {
      if (initStarted || isClosing) return;
      initStarted = true;

      try {
        const ai = getGeminiClient();
        const userContext = await resolveUserContext(token);
        sessionRole = userContext?.role;
        const snippet = await fetchAuthorizedPortalSnippet(userContext, pageContext || '');
        const systemInstruction = buildSystemInstruction(
          userContext,
          pageContext,
          recentError,
          snippet
        );

        const session = await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction,
            ...(userContext ? { tools: [{ functionDeclarations: [navigateToolDeclaration] }] } : {}),
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              const content = message.serverContent;
              if (content?.inputTranscription?.text) {
                sendWsJson(clientWs, {
                  type: 'inputTranscript',
                  text: content.inputTranscription.text,
                  finished: Boolean(content.inputTranscription.finished),
                });
              }
              if (content?.outputTranscription?.text) {
                sendWsJson(clientWs, {
                  type: 'outputTranscript',
                  text: content.outputTranscription.text,
                  finished: Boolean(content.outputTranscription.finished),
                });
              }
              for (const part of content?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  sendWsJson(clientWs, {
                    type: 'audio',
                    audio: part.inlineData.data,
                  });
                }
              }

              if (message.toolCall?.functionCalls?.length && liveSession) {
                const functionResponses = message.toolCall.functionCalls.map((fc) => {
                  if (fc.name === 'navigate_to_page') {
                    const args = (fc.args || {}) as {
                      tabId?: string;
                      searchQuery?: string;
                      roleFilter?: string;
                    };
                    const navAction = validateNavigationAction(sessionRole, args);
                    if (navAction) {
                      sendWsJson(clientWs, {
                        type: 'navigate',
                        action: navAction,
                      });
                      return {
                        id: fc.id,
                        name: fc.name,
                        response: {
                          ok: true,
                          navigatedTo: navAction.tabLabel,
                          searchQuery: navAction.searchQuery || null,
                        },
                      };
                    }
                    return {
                      id: fc.id,
                      name: fc.name,
                      response: {
                        ok: false,
                        error: 'Requested section is not available for the current user role.',
                      },
                    };
                  }
                  return {
                    id: fc.id,
                    name: fc.name,
                    response: { ok: false, error: 'Unsupported tool.' },
                  };
                });

                try {
                  liveSession.sendToolResponse({ functionResponses });
                } catch {
                  // ignore response errors if closing
                }
              }

              if (content?.interrupted) {
                sendWsJson(clientWs, { type: 'interrupted' });
              }
              if (content?.turnComplete) {
                sendWsJson(clientWs, { type: 'turnComplete' });
              }
            },
            onerror: (event: any) => {
              const errMsg = formatGeminiError(event?.error || event?.message || event);
              sendWsJson(clientWs, { type: 'error', message: errMsg });
            },
            onclose: () => {
              if (!isClosing) {
                sendWsJson(clientWs, { type: 'closed' });
                closeAll();
              }
            },
          },
        });

        if (isClosing) {
          session.close();
          return;
        }
        liveSession = session;
        sendWsJson(clientWs, {
          type: 'ready',
          role: userContext?.role || 'GUEST',
        });
      } catch (err) {
        sendWsJson(clientWs, {
          type: 'error',
          message: formatGeminiError(err),
        });
        closeAll();
      }
    };

    clientWs.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg.type === 'init') {
          void startLiveSession(msg.token, msg.pageContext, msg.recentError);
          return;
        }
        if (!liveSession) return;

        if (msg.type === 'audio' && typeof msg.audio === 'string' && msg.audio.length > 0) {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (msg.type === 'text' && typeof msg.text === 'string' && msg.text.trim()) {
          liveSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: msg.text.trim() }] }],
            turnComplete: true,
          });
        }
      } catch (err) {
        sendWsJson(clientWs, {
          type: 'error',
          message: formatGeminiError(err),
        });
      }
    });

    clientWs.on('close', closeAll);
    clientWs.on('error', closeAll);
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const transient = /503|UNAVAILABLE|high demand|ECONNRESET|ETIMEDOUT/i.test(msg);
      if (!transient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

export async function handleAssistantTextAsk(req: Request, res: Response) {
  try {
    const { message, history, pageContext, recentError } = req.body as {
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
      pageContext?: string;
      recentError?: {
        title?: string;
        message?: string;
        fieldLabel?: string;
        pageContext?: string;
      } | null;
    };

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Please enter a question for the assistant.' });
    }

    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : null;
    const userContext = await resolveUserContext(token);

    const portalSnippet = await fetchAuthorizedPortalSnippet(userContext, message.trim());
    const ai = getGeminiClient();
    const systemInstruction = buildSystemInstruction(
      userContext,
      pageContext,
      recentError,
      portalSnippet
    );

    const contents = [
      ...(Array.isArray(history)
        ? history.slice(-8).map((item) => ({
            role: item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: item.text }],
          }))
        : []),
      { role: 'user', parts: [{ text: message.trim() }] },
    ];

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description:
                  'Helpful, concise plain-language reply answering the query, confirming navigation, or giving step-by-step instructions to solve any entry error.',
              },
              navigateTo: {
                type: Type.OBJECT,
                nullable: true,
                description:
                  'Include ONLY when the user wants to open/view/search a page in the portal OR needs to navigate to another page to resolve an error.',
                properties: {
                  tabId: {
                    type: Type.STRING,
                    description: 'Exact tabId from the Available navigation tabs list.',
                  },
                  searchQuery: {
                    type: Type.STRING,
                    nullable: true,
                    description: 'Optional search/filter string to apply on the destination page.',
                  },
                  roleFilter: {
                    type: Type.STRING,
                    nullable: true,
                    description: 'Optional role filter for users tab: ALL, ADMIN, TEACHER, PARENT, or STUDENT.',
                  },
                },
                required: ['tabId'],
              },
            },
            required: ['reply'],
          },
        },
      })
    );

    const rawText = (response.text || '').trim();
    let parsed: {
      reply?: string;
      navigateTo?: { tabId?: string; searchQuery?: string | null; roleFilter?: string | null } | null;
    } = {};

    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { reply: rawText };
    }

    const navigationAction = validateNavigationAction(userContext?.role, parsed.navigateTo);

    return res.json({
      reply:
        parsed.reply?.trim() ||
        'I could not generate a response right now. Please try again.',
      navigationAction,
    });
  } catch (err) {
    console.error('Assistant text request error:', err);
    return res.status(502).json({ error: formatGeminiError(err) });
  }
}
