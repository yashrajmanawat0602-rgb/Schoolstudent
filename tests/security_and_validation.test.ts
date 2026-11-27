import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildUpiPaymentLinks,
  computeGrade,
  hashPassword,
  isValidTransactionRef,
  isValidUpiVpa,
  normalizeIndianPhone,
  parseMarksCsv,
  resolveSafeUploadPath,
  signPaymentIntentToken,
  signSessionToken,
  verifyPassword,
  verifyPaymentIntentToken,
  verifyRazorpaySignature,
  verifySessionToken,
} from '../src/utils/security.ts';

describe('SchoolConnect Authentication & Token Security', () => {
  it('hashes passwords with unique salts and verifies accurately', () => {
    const hash1 = hashPassword('Demo@2026!');
    const hash2 = hashPassword('Demo@2026!');
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toContain('Demo@2026!');
    expect(verifyPassword('Demo@2026!', hash1)).toBe(true);
    expect(verifyPassword('WrongPassword', hash1)).toBe(false);
  });

  it('signs and verifies HMAC session tokens for School ID accounts and rejects tampered tokens', () => {
    const token = signSessionToken({
      userId: 42,
      username: 'PAR-SHARMA',
      email: null,
      role: 'PARENT',
    });

    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(42);
    expect(verified?.username).toBe('PAR-SHARMA');
    expect(verified?.role).toBe('PARENT');

    const tampered = `${token.slice(0, -4)}xxxx`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it('signs and verifies Admin session tokens via username authentication', () => {
    const adminToken = signSessionToken({
      userId: 1,
      username: 'Adminmva',
      email: null,
      role: 'ADMIN',
      authProvider: 'SCHOOL_ID',
    });
    const decoded = verifySessionToken(adminToken);
    expect(decoded).not.toBeNull();
    expect(decoded?.username).toBe('Adminmva');
    expect(decoded?.authProvider).toBe('SCHOOL_ID');
    expect(decoded?.role).toBe('ADMIN');
  });
});

describe('SchoolConnect Marks & CSV Validation', () => {
  it('computes accurate letter grades from obtained and max marks', () => {
    expect(computeGrade(91, 100)).toBe('A+');
    expect(computeGrade(84, 100)).toBe('A');
    expect(computeGrade(73, 100)).toBe('B+');
    expect(computeGrade(62, 100)).toBe('B');
    expect(computeGrade(54, 100)).toBe('C');
    expect(computeGrade(35, 100)).toBe('F');
  });

  it('validates CSV bulk marks and rejects marks exceeding maximum marks', () => {
    const csv = [
      'Student ID,Subject,Exam,Marks,Max Marks,Remark',
      'STU-10A-001,Mathematics,Mid-Term Examination,87,100,Strong improvement',
      'STU-10A-002,Mathematics,Mid-Term Examination,108,100,Invalid overflow',
      'STU-10A-003,Mathematics,Mid-Term Examination,-5,100,Negative invalid',
    ].join('\n');

    const res = parseMarksCsv(csv);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].studentCode).toBe('STU-10A-001');
    expect(res.rows[0].obtainedMarks).toBe(87);
    expect(res.errors).toHaveLength(2);
    expect(res.errors[0]).toContain('cannot exceed maximum marks');
    expect(res.errors[1]).toContain('non-negative');
  });
});

describe('File Upload Path Confinement', () => {
  it('confines resolved file paths strictly inside uploads directory', () => {
    const base = path.resolve('/app/applet/uploads');
    const safe = resolveSafeUploadPath(base, 'study_guide_123.pdf');
    expect(safe).toBe(path.join(base, 'study_guide_123.pdf'));

    // Traversal sequence stripped via basename + prefix boundary check
    const traversal = resolveSafeUploadPath(base, '../../etc/passwd');
    expect(traversal).toBe(path.join(base, 'passwd'));
  });
});

describe('Online UPI & Gateway Fee Payment Security', () => {
  it('signs and verifies payment intent integrity tokens and rejects tampering', () => {
    const token = signPaymentIntentToken({
      paymentId: 101,
      feeRecordId: 55,
      studentId: 12,
      userId: 88,
      amount: 14500,
      merchantTxnId: 'MVATEST1234',
    });

    const decoded = verifyPaymentIntentToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.amount).toBe(14500);
    expect(decoded?.feeRecordId).toBe(55);

    expect(verifyPaymentIntentToken(`${token.slice(0, -3)}abc`)).toBeNull();
  });

  it('verifies Razorpay HMAC-SHA256 payment signatures with timing-safe comparison', () => {
    const secret = 'rzp_test_secret_123456';
    const orderId = 'order_MVA123';
    const paymentId = 'pay_MVA456';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(verifyRazorpaySignature({ orderId, paymentId, signature, secret })).toBe(true);
    expect(
      verifyRazorpaySignature({ orderId, paymentId, signature: `${signature.slice(0, -2)}00`, secret })
    ).toBe(false);
  });

  it('builds NPCI UPI links for PhonePe, Google Pay, and Paytm and validates VPA/phone/UTR', () => {
    const links = buildUpiPaymentLinks({
      upiId: 'macrovision.fees@okaxis',
      payeeName: 'Macro Vision Academy Burhanpur',
      amountInr: 12500,
      txnRef: 'MVA99887766',
      note: 'STU-10A-001 Term 2 Fee',
    });

    expect(links.upiUri).toContain('upi://pay?');
    expect(links.phonePeUri).toContain('phonepe://pay?');
    expect(links.gpayUri).toContain('tez://upi/pay?');
    expect(links.paytmUri).toContain('paytmmp://pay?');
    expect(links.upiUri).toContain('am=12500.00');
    expect(links.upiUri).toContain('cu=INR');

    expect(normalizeIndianPhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizeIndianPhone('12345')).toBeNull();
    expect(isValidUpiVpa('9876543210@ybl')).toBe(true);
    expect(isValidUpiVpa('invalid-upi')).toBe(false);
    expect(isValidTransactionRef('433018492014')).toBe(true);
    expect(isValidTransactionRef('123')).toBe(false);
  });
});

