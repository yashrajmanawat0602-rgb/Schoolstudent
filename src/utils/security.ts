import crypto from 'node:crypto';
import path from 'node:path';

export type UserRole = 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';

declare global {
  var _scAuthSecret: string | undefined;
}

function getAuthSecret(): string {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    return process.env.AUTH_SECRET;
  }
  if (!global._scAuthSecret) {
    global._scAuthSecret = crypto.randomBytes(32).toString('hex');
  }
  return global._scAuthSecret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  try {
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derivedBuf = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derivedBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, derivedBuf);
  } catch {
    return false;
  }
}

export interface SessionTokenPayload {
  userId: number;
  email?: string | null;
  username?: string | null;
  role: UserRole;
  authProvider?: 'SCHOOL_ID' | 'GOOGLE';
  exp: number;
}

export function signSessionToken(payload: Omit<SessionTokenPayload, 'exp'>, ttlHours = 24): string {
  const fullPayload: SessionTokenPayload = {
    ...payload,
    exp: Date.now() + ttlHours * 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(body)
    .digest('base64url');
  return `sc_v1.${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  if (!token || !token.startsWith('sc_v1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(body)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (!parsed.userId || !parsed.role || !parsed.exp) return null;
    if (!parsed.email && !parsed.username) return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function computeGrade(obtained: number, max: number): string {
  if (max <= 0) return 'N/A';
  const pct = (obtained / max) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

export interface ParsedCsvMarkRow {
  rowNumber: number;
  studentCode: string;
  subjectName: string;
  examName: string;
  obtainedMarks: number;
  maxMarks: number;
  remark: string;
}

export interface CsvParseResult {
  rows: ParsedCsvMarkRow[];
  errors: string[];
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseMarksCsv(csvText: string): CsvParseResult {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ['CSV file is empty.'] };
  }

  const rows: ParsedCsvMarkRow[] = [];
  const errors: string[] = [];

  // Detect header line
  const firstCols = splitCsvLine(lines[0]).map((c) => c.toLowerCase());
  const hasHeader =
    firstCols[0]?.includes('student') ||
    firstCols[1]?.includes('subject') ||
    firstCols[3]?.includes('marks');

  const startIdx = hasHeader ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const rowNumber = i + 1;
    if (cols.length < 5) {
      errors.push(`Row ${rowNumber}: Expected at least 5 columns (Student ID, Subject, Exam, Marks, Max Marks, Remark).`);
      continue;
    }

    const [studentCode, subjectName, examName, marksStr, maxMarksStr, remark = ''] = cols;
    const obtainedMarks = Number(marksStr);
    const maxMarks = Number(maxMarksStr);

    if (!studentCode) {
      errors.push(`Row ${rowNumber}: Student ID is required.`);
      continue;
    }
    if (!subjectName) {
      errors.push(`Row ${rowNumber}: Subject is required.`);
      continue;
    }
    if (!examName) {
      errors.push(`Row ${rowNumber}: Exam name is required.`);
      continue;
    }
    if (!Number.isFinite(obtainedMarks) || !Number.isInteger(obtainedMarks) || obtainedMarks < 0) {
      errors.push(`Row ${rowNumber} (${studentCode}): Marks must be a non-negative whole number.`);
      continue;
    }
    if (!Number.isFinite(maxMarks) || !Number.isInteger(maxMarks) || maxMarks <= 0) {
      errors.push(`Row ${rowNumber} (${studentCode}): Maximum marks must be a positive whole number.`);
      continue;
    }
    if (obtainedMarks > maxMarks) {
      errors.push(`Row ${rowNumber} (${studentCode}): Marks (${obtainedMarks}) cannot exceed maximum marks (${maxMarks}).`);
      continue;
    }

    rows.push({
      rowNumber,
      studentCode,
      subjectName,
      examName,
      obtainedMarks,
      maxMarks,
      remark,
    });
  }

  return { rows, errors };
}

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.csv',
]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// Minimum 1 GB+ requirement -> support up to 2 GB per student activity photo/video
export const MAX_ACTIVITY_MEDIA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export const ALLOWED_ACTIVITY_IMAGE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
]);

export const ALLOWED_ACTIVITY_VIDEO_EXTS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.m4v',
  '.3gp',
]);

export function signMediaAccessToken(
  payload: { userId: number; activityId: number },
  ttlMinutes = 120
): string {
  const fullPayload = {
    userId: payload.userId,
    activityId: payload.activityId,
    exp: Date.now() + ttlMinutes * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(`media:${body}`)
    .digest('base64url');
  return `scm_v1.${body}.${sig}`;
}

export function verifyMediaAccessToken(
  token: string,
  expectedActivityId: number
): { userId: number; activityId: number } | null {
  if (!token || !token.startsWith('scm_v1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(`media:${body}`)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      userId: number;
      activityId: number;
      exp: number;
    };
    if (!parsed.userId || !parsed.activityId || !parsed.exp) return null;
    if (parsed.activityId !== expectedActivityId) return null;
    if (Date.now() > parsed.exp) return null;
    return { userId: parsed.userId, activityId: parsed.activityId };
  } catch {
    return null;
  }
}

export function sanitizeStoredFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const base = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);
  const suffix = crypto.randomBytes(6).toString('hex');
  return `${base || 'document'}_${suffix}${ext}`;
}

export function resolveSafeUploadPath(baseDir: string, filename: string): string | null {
  const resolvedBase = path.resolve(baseDir);
  const target = path.resolve(resolvedBase, path.basename(filename));
  if (!target.startsWith(resolvedBase + path.sep)) {
    return null;
  }
  return target;
}

export type FeePaymentMethod =
  | 'PHONEPE'
  | 'GOOGLE_PAY'
  | 'PAYTM'
  | 'BHIM_UPI'
  | 'UPI_ID'
  | 'CARD'
  | 'NETBANKING';

export interface PaymentIntentTokenPayload {
  paymentId: number;
  feeRecordId: number;
  studentId: number;
  userId: number;
  amount: number;
  merchantTxnId: string;
  exp: number;
}

export function signPaymentIntentToken(
  payload: Omit<PaymentIntentTokenPayload, 'exp'>,
  ttlMinutes = 30
): string {
  const fullPayload: PaymentIntentTokenPayload = {
    ...payload,
    exp: Date.now() + ttlMinutes * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(`pay:${body}`)
    .digest('base64url');
  return `scpay_v1.${body}.${sig}`;
}

export function verifyPaymentIntentToken(token: string): PaymentIntentTokenPayload | null {
  if (!token || !token.startsWith('scpay_v1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(`pay:${body}`)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as PaymentIntentTokenPayload;
    if (
      !parsed.paymentId ||
      !parsed.feeRecordId ||
      !parsed.studentId ||
      !parsed.userId ||
      !parsed.amount ||
      !parsed.merchantTxnId ||
      !parsed.exp
    ) {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean {
  const { orderId, paymentId, signature, secret } = params;
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const trimmed =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  if (!/^[6-9]\d{9}$/.test(trimmed)) return null;
  return trimmed;
}

export function isValidUpiVpa(vpa: string): boolean {
  return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/.test(vpa.trim());
}

export function isValidTransactionRef(ref: string): boolean {
  return /^[A-Za-z0-9_-]{10,36}$/.test(ref.trim());
}

export function buildUpiPaymentLinks(params: {
  upiId: string;
  payeeName: string;
  amountInr: number;
  txnRef: string;
  note: string;
}) {
  const query = new URLSearchParams({
    pa: params.upiId.trim(),
    pn: params.payeeName.trim().slice(0, 60),
    tr: params.txnRef.trim(),
    tn: params.note.trim().slice(0, 80),
    am: params.amountInr.toFixed(2),
    cu: 'INR',
  }).toString();

  return {
    upiUri: `upi://pay?${query}`,
    phonePeUri: `phonepe://pay?${query}`,
    gpayUri: `tez://upi/pay?${query}`,
    paytmUri: `paytmmp://pay?${query}`,
  };
}

