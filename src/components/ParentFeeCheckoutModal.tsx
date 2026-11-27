import React, { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Lock,
  Printer,
  QrCode,
  Receipt,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import {
  FeeMerchantConfig,
  FeePayerDefaults,
  FeePaymentIntentResponse,
  FeePaymentReceiptResponse,
  FeeRecordItem,
} from '../types/index.ts';
import { useToast } from './ui/ToastAndModal.tsx';

type PaymentMethodId =
  | 'PHONEPE'
  | 'GOOGLE_PAY'
  | 'PAYTM'
  | 'BHIM_UPI'
  | 'UPI_ID'
  | 'CARD'
  | 'NETBANKING';

const PAYMENT_METHODS: Array<{
  id: PaymentMethodId;
  label: string;
  subtitle: string;
  badgeText: string;
  badgeClass: string;
}> = [
  {
    id: 'PHONEPE',
    label: 'PhonePe',
    subtitle: 'Instant UPI app or QR',
    badgeText: 'Pe',
    badgeClass: 'bg-[#5F259F] text-white',
  },
  {
    id: 'GOOGLE_PAY',
    label: 'Google Pay',
    subtitle: 'GPay UPI app or QR',
    badgeText: 'GPay',
    badgeClass: 'bg-[#1A73E8] text-white',
  },
  {
    id: 'PAYTM',
    label: 'Paytm UPI',
    subtitle: 'Paytm wallet / UPI',
    badgeText: 'Paytm',
    badgeClass: 'bg-[#00BAF2] text-slate-950',
  },
  {
    id: 'BHIM_UPI',
    label: 'BHIM / Any UPI',
    subtitle: 'Amazon Pay, Cred, Bank UPI',
    badgeText: 'UPI',
    badgeClass: 'bg-emerald-700 text-white',
  },
  {
    id: 'UPI_ID',
    label: 'Enter UPI ID',
    subtitle: 'Pay using @ybl / @okaxis',
    badgeText: '@UPI',
    badgeClass: 'bg-slate-800 text-white dark:bg-slate-700',
  },
  {
    id: 'CARD',
    label: 'Card / NetBanking',
    subtitle: 'Debit, Credit or Bank Transfer',
    badgeText: 'CARD',
    badgeClass: 'bg-amber-600 text-white',
  },
];

export function formatPaymentMethodLabel(method?: string | null): string {
  switch (method) {
    case 'PHONEPE':
      return 'PhonePe UPI';
    case 'GOOGLE_PAY':
      return 'Google Pay (GPay)';
    case 'PAYTM':
      return 'Paytm UPI';
    case 'BHIM_UPI':
      return 'BHIM / UPI QR';
    case 'UPI_ID':
      return 'UPI ID';
    case 'CARD':
      return 'Debit / Credit Card';
    case 'NETBANKING':
      return 'NetBanking';
    case 'ADMIN_CASH':
      return 'School Office Counter';
    default:
      return 'Online Payment';
  }
}

function isSafePaymentDeepLink(uri: string): boolean {
  return (
    uri.startsWith('upi://pay?') ||
    uri.startsWith('phonepe://pay?') ||
    uri.startsWith('tez://upi/pay?') ||
    uri.startsWith('paytmmp://pay?')
  );
}

function loadRazorpayCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[data-razorpay-checkout="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface ParentFeeCheckoutModalProps {
  item: FeeRecordItem;
  studentId: number;
  merchantConfig?: FeeMerchantConfig;
  payerDefaults?: FeePayerDefaults;
  onClose: () => void;
  onSuccess: () => void;
  onDownloadTextReceipt: (item: FeeRecordItem) => void;
}

export const ParentFeeCheckoutModal: React.FC<ParentFeeCheckoutModalProps> = ({
  item,
  studentId,
  merchantConfig,
  payerDefaults,
  onClose,
  onSuccess,
  onDownloadTextReceipt,
}) => {
  const { schoolSettings, user } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<'details' | 'pay' | 'receipt'>('details');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>('PHONEPE');
  const [payerName, setPayerName] = useState(
    payerDefaults?.fullName || payerDefaults?.fatherName || user?.fullName || ''
  );
  const [payerPhone, setPayerPhone] = useState(payerDefaults?.phone || '');
  const [payerEmail, setPayerEmail] = useState(payerDefaults?.email || '');
  const [payerUpiId, setPayerUpiId] = useState('');

  const [creatingIntent, setCreatingIntent] = useState(false);
  const [intent, setIntent] = useState<FeePaymentIntentResponse | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const [utrNumber, setUtrNumber] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [bankName, setBankName] = useState('SBI / HDFC / ICICI / Axis');
  const [verifying, setVerifying] = useState(false);
  const [receiptData, setReceiptData] = useState<FeePaymentReceiptResponse | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setFormError('');
  }, [selectedMethod, step]);

  const handleCreateIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanPhone = payerPhone.replace(/\D/g, '');
    const tenDigitPhone =
      cleanPhone.length === 12 && cleanPhone.startsWith('91')
        ? cleanPhone.slice(2)
        : cleanPhone.length === 11 && cleanPhone.startsWith('0')
          ? cleanPhone.slice(1)
          : cleanPhone;

    if (!/^[6-9]\d{9}$/.test(tenDigitPhone)) {
      setFormError('Please enter a valid 10-digit mobile number for payment receipt SMS/verification.');
      return;
    }

    if (selectedMethod === 'UPI_ID') {
      if (!/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/.test(payerUpiId.trim())) {
        setFormError('Please enter a valid UPI ID such as 9876543210@ybl or name@okaxis.');
        return;
      }
    }

    setCreatingIntent(true);
    try {
      const created = await apiFetch<FeePaymentIntentResponse>(
        `/api/students/${studentId}/fees/${item.id}/payment-intent`,
        {
          method: 'POST',
          body: JSON.stringify({
            paymentMethod: selectedMethod,
            payerName: payerName.trim(),
            payerPhone: tenDigitPhone,
            payerEmail: payerEmail.trim(),
            payerUpiId: payerUpiId.trim(),
          }),
        }
      );
      setIntent(created);
      setStep('pay');
    } catch (err: any) {
      setFormError(err?.message || 'Unable to start payment session.');
    } finally {
      setCreatingIntent(false);
    }
  };

  const handleCopyUpi = async () => {
    const vpa = intent?.merchantUpiId || merchantConfig?.upiId;
    if (!vpa) return;
    try {
      await navigator.clipboard.writeText(vpa);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch {
      showToast('Merchant UPI ID', vpa, 'info');
    }
  };

  const handleVerifyUpiOrBankPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent) return;
    setFormError('');

    const trimmedRef = utrNumber.trim().toUpperCase();
    if (!/^[A-Za-z0-9_-]{10,36}$/.test(trimmedRef)) {
      setFormError(
        selectedMethod === 'CARD' || selectedMethod === 'NETBANKING'
          ? 'Enter your 10–36 character Bank / Card Transaction Reference ID.'
          : 'Enter the 12-digit UTR / UPI Transaction Reference shown in PhonePe, GPay, or Paytm.'
      );
      return;
    }

    if (selectedMethod === 'CARD' && !/^\d{4}$/.test(cardLast4.trim())) {
      setFormError('Enter only the last 4 digits of your card for receipt verification.');
      return;
    }

    setVerifying(true);
    try {
      const verified = await apiFetch<FeePaymentReceiptResponse>(
        `/api/students/${studentId}/fees/${item.id}/payment-verify`,
        {
          method: 'POST',
          body: JSON.stringify({
            paymentId: intent.paymentId,
            integrityToken: intent.integrityToken,
            utrNumber: trimmedRef,
            payerUpiId: payerUpiId.trim(),
            cardLast4: selectedMethod === 'CARD' ? cardLast4.trim() : '',
            bankName: selectedMethod === 'CARD' || selectedMethod === 'NETBANKING' ? bankName : '',
          }),
        }
      );
      setReceiptData(verified);
      setStep('receipt');
      showToast('Fee Payment Verified', `Receipt ${verified.receipt.receiptNo} issued.`);
      onSuccess();
    } catch (err: any) {
      setFormError(err?.message || 'Payment verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleLaunchRazorpay = async () => {
    if (!intent?.razorpayKeyId || !intent?.gatewayOrderId) return;
    setVerifying(true);
    setFormError('');
    try {
      const loaded = await loadRazorpayCheckoutScript();
      const RazorpayCtor = (window as any).Razorpay;
      if (!loaded || !RazorpayCtor) {
        setFormError('Unable to load online gateway checkout. You can still pay directly via UPI QR or UTR below.');
        setVerifying(false);
        return;
      }

      const rzp = new RazorpayCtor({
        key: intent.razorpayKeyId,
        amount: intent.amount * 100,
        currency: 'INR',
        name: intent.merchantPayeeName,
        description: `${payerDefaults?.studentCode || ''} · ${item.title}`,
        order_id: intent.gatewayOrderId,
        prefill: {
          name: payerName.trim(),
          email: payerEmail.trim() || undefined,
          contact: payerPhone.replace(/\D/g, '').slice(-10),
        },
        theme: {
          color: schoolSettings?.primaryColor || '#1E3A8A',
        },
        handler: async (resp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verified = await apiFetch<FeePaymentReceiptResponse>(
              `/api/students/${studentId}/fees/${item.id}/payment-verify`,
              {
                method: 'POST',
                body: JSON.stringify({
                  paymentId: intent.paymentId,
                  integrityToken: intent.integrityToken,
                  razorpayOrderId: resp.razorpay_order_id,
                  razorpayPaymentId: resp.razorpay_payment_id,
                  razorpaySignature: resp.razorpay_signature,
                }),
              }
            );
            setReceiptData(verified);
            setStep('receipt');
            showToast('Payment Confirmed', `Receipt ${verified.receipt.receiptNo} issued.`);
            onSuccess();
          } catch (verifyErr: any) {
            setFormError(verifyErr?.message || 'Gateway signature verification failed.');
          } finally {
            setVerifying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setVerifying(false);
          },
        },
      });
      rzp.open();
    } catch (err: any) {
      setFormError(err?.message || 'Could not launch checkout.');
      setVerifying(false);
    }
  };

  const activeDeepLink =
    intent &&
    (selectedMethod === 'PHONEPE'
      ? intent.upiLinks.phonePeUri
      : selectedMethod === 'GOOGLE_PAY'
        ? intent.upiLinks.gpayUri
        : selectedMethod === 'PAYTM'
          ? intent.upiLinks.paytmUri
          : intent.upiLinks.upiUri);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--sc-primary)] text-white flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {step === 'receipt'
                  ? 'Official School Fee Receipt'
                  : 'Secure Online School Fee Payment'}
              </h3>
              <p className="text-xs text-slate-500">
                {schoolSettings?.schoolName || 'Macro Vision Academy Burhanpur'} · 256-bit Signed Checkout
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 max-h-[82vh] overflow-y-auto space-y-5">
          {/* Step Progress Indicator */}
          {step !== 'receipt' && (
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span
                className={`px-2.5 py-1 rounded-md ${
                  step === 'details'
                    ? 'bg-[var(--sc-primary)] text-white'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                }`}
              >
                1. Student &amp; Payer Details
              </span>
              <span className="text-slate-400">→</span>
              <span
                className={`px-2.5 py-1 rounded-md ${
                  step === 'pay'
                    ? 'bg-[var(--sc-primary)] text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                2. Pay via PhonePe / GPay / UPI &amp; Verify
              </span>
            </div>
          )}

          {/* Student & Fee Summary Strip */}
          {step !== 'receipt' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-slate-500">Student Details</div>
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                  {payerDefaults?.studentName || `Student #${studentId}`}
                </div>
                <div className="font-mono text-slate-500 mt-0.5">
                  {payerDefaults?.studentCode || `ID #${studentId}`}
                  {payerDefaults?.className ? ` · ${payerDefaults.className}-${payerDefaults.section}` : ''}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Fee Invoice</div>
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                  {item.title}
                </div>
                <div className="text-slate-500 mt-0.5">
                  {item.category} · Due {item.dueDate}
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-slate-500">Total Payable (₹0 Platform Fee)</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[var(--sc-primary)] dark:text-blue-400 mt-0.5">
                  ₹{item.amount.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                  Server-verified amount
                </div>
              </div>
            </div>
          )}

          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300">
              {formError}
            </div>
          )}

          {/* STEP 1: Payer Info & Payment App Selection */}
          {step === 'details' && (
            <form onSubmit={handleCreateIntent} className="space-y-5">
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Required Billing &amp; Receipt Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Parent / Payer Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="Full name for school receipt"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Mobile Number (10-digit) *
                    </label>
                    <input
                      type="tel"
                      required
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Email Address for E-Receipt (Optional)
                    </label>
                    <input
                      type="email"
                      value={payerEmail}
                      onChange={(e) => setPayerEmail(e.target.value)}
                      placeholder="parent@example.com"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Choose Easy Payment Method
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {PAYMENT_METHODS.map((m) => {
                    const active = selectedMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethod(m.id)}
                        className={`text-left rounded-xl border p-3 transition-all flex items-center gap-3 ${
                          active
                            ? 'border-[var(--sc-primary)] bg-blue-50/70 dark:bg-blue-950/30 ring-2 ring-[var(--sc-primary)]/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-10 h-10 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 ${m.badgeClass}`}
                        >
                          {m.badgeText}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {m.label}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{m.subtitle}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedMethod === 'UPI_ID' && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Your UPI ID (PhonePe / GPay / Paytm / BHIM) *
                    </label>
                    <input
                      type="text"
                      required
                      value={payerUpiId}
                      onChange={(e) => setPayerUpiId(e.target.value)}
                      placeholder="e.g. 9876543210@ybl or name@okicici"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  Paid to {merchantConfig?.payeeName || 'School Official Account'} (
                  <span className="font-mono">{merchantConfig?.upiId || 'macrovision.fees@okaxis'}</span>)
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingIntent}
                    className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-[var(--sc-primary)] text-white hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    {creatingIntent
                      ? 'Creating Secure Order...'
                      : `Proceed to Pay ₹${item.amount.toLocaleString()}`}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 2: QR Scan / PhonePe & GPay Deep Link / UTR Verification */}
          {step === 'pay' && intent && (
            <div className="space-y-5">
              {intent.gatewayProvider === 'RAZORPAY' && intent.razorpayKeyId && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Instant Razorpay Gateway Ready
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Pay directly with PhonePe, Google Pay, Paytm, Cards, or NetBanking with auto-verification.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={handleLaunchRazorpay}
                    className="px-4 py-2.5 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold shrink-0 disabled:opacity-60"
                  >
                    {verifying ? 'Opening Checkout...' : 'Pay via Razorpay Checkout'}
                  </button>
                </div>
              )}

              {selectedMethod !== 'CARD' ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  {/* Real Scannable UPI QR Code */}
                  <div className="md:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 flex flex-col items-center text-center space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <QrCode className="w-4 h-4 text-[var(--sc-primary)]" />
                      Scan QR with Any UPI App
                    </div>
                    <img
                      src={intent.qrDataUrl}
                      alt={`UPI QR Code for ₹${intent.amount}`}
                      className="w-44 h-44 rounded-lg border border-slate-200 dark:border-slate-800 bg-white p-1"
                    />
                    <div className="text-[11px] text-slate-500">
                      Supports PhonePe · Google Pay · Paytm · BHIM
                    </div>
                    <div className="w-full rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] truncate text-slate-700 dark:text-slate-300">
                        {intent.merchantUpiId}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--sc-primary)] dark:text-blue-400 shrink-0"
                      >
                        {copiedUpi ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedUpi ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Mobile 1-Tap Deep Links & Step Instructions */}
                  <div className="md:col-span-7 space-y-3.5">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          Order Ref: <span className="font-mono">{intent.merchantTxnId}</span>
                        </span>
                        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                          ₹{intent.amount.toLocaleString()} INR
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Payee: <span className="font-medium text-slate-800 dark:text-slate-200">{intent.merchantPayeeName}</span>
                      </div>

                      {activeDeepLink && isSafePaymentDeepLink(activeDeepLink) && (
                        <div className="pt-1 flex flex-wrap gap-2">
                          <a
                            href={activeDeepLink}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold hover:opacity-95"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            Open {formatPaymentMethodLabel(selectedMethod)} on Mobile
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          {isSafePaymentDeepLink(intent.upiLinks.upiUri) && (
                            <a
                              href={intent.upiLinks.upiUri}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              Choose Any UPI App
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                      <div className="font-semibold text-amber-900 dark:text-amber-300">
                        How to complete payment in 2 easy steps:
                      </div>
                      <p>1. Scan the QR code (or tap Open App on your phone) and pay exactly ₹{intent.amount.toLocaleString()}.</p>
                      <p>2. Copy the <strong>12-digit UTR / UPI Reference ID</strong> from your PhonePe, GPay, or Paytm receipt and enter it below to unlock your official school receipt.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-sm text-slate-900 dark:text-slate-100">
                    <Building2 className="w-4 h-4 text-[var(--sc-primary)]" />
                    School Bank Account &amp; Card / NetBanking Transfer Details
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    Payee: <strong>{intent.merchantPayeeName}</strong> · {intent.bankAccountSummary}
                  </p>
                  <p className="font-mono text-slate-500">
                    Order Reference: {intent.merchantTxnId} · Exact Amount: ₹{intent.amount.toLocaleString()}
                  </p>
                </div>
              )}

              {/* Verification Form */}
              <form
                onSubmit={handleVerifyUpiOrBankPayment}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={selectedMethod === 'CARD' ? '' : 'sm:col-span-2'}>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      {selectedMethod === 'CARD'
                        ? 'Bank / Card Transaction Reference Number *'
                        : '12-Digit UTR / UPI Transaction Reference Number *'}
                    </label>
                    <input
                      type="text"
                      required
                      minLength={10}
                      maxLength={36}
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder={
                        selectedMethod === 'CARD'
                          ? 'e.g. TXN9823410982'
                          : 'e.g. 433018492014 (from PhonePe / GPay / Paytm)'
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono uppercase"
                    />
                  </div>

                  {selectedMethod === 'CARD' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Last 4 Digits of Card *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        value={cardLast4}
                        onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="e.g. 4242 (no CVV needed)"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  )}

                  {selectedMethod === 'CARD' && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Issuing Bank / Network
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep('details')}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  >
                    ← Change Method
                  </button>
                  <button
                    type="submit"
                    disabled={verifying}
                    className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {verifying ? 'Verifying Payment...' : 'Verify Payment & Issue Receipt'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 3: Official Verified Payment Receipt */}
          {step === 'receipt' && receiptData && (
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Payment Verified &amp; Fee Settled
                  </div>
                  <div className="text-xs text-emerald-800 dark:text-emerald-300">
                    Receipt <span className="font-mono font-semibold">{receiptData.receipt.receiptNo}</span> ·
                    Transaction Ref <span className="font-mono font-semibold">{receiptData.receipt.transactionRef}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {schoolSettings?.schoolName || 'Macro Vision Academy Burhanpur'}
                    </div>
                    <div className="text-xs text-slate-500">Official Digital Fee Payment Receipt</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Amount Paid</div>
                    <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                      ₹{receiptData.receipt.amount.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500">Receipt Number</div>
                    <div className="font-mono font-semibold mt-0.5">{receiptData.receipt.receiptNo}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">UTR / Transaction Ref</div>
                    <div className="font-mono font-semibold mt-0.5">{receiptData.receipt.transactionRef}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Student Name &amp; ID</div>
                    <div className="font-medium mt-0.5">
                      {receiptData.receipt.studentName} ({receiptData.receipt.studentCode})
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Class &amp; Section</div>
                    <div className="font-medium mt-0.5">
                      {receiptData.receipt.className}-{receiptData.receipt.section}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Fee Description</div>
                    <div className="font-medium mt-0.5">
                      {receiptData.receipt.feeTitle} ({receiptData.receipt.feeCategory})
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Payment Method</div>
                    <div className="font-medium mt-0.5">
                      {formatPaymentMethodLabel(receiptData.receipt.paymentMethod)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Payer Name &amp; Mobile</div>
                    <div className="font-medium mt-0.5">
                      {receiptData.receipt.payerName} · {receiptData.receipt.payerPhone}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Paid Date</div>
                    <div className="font-mono font-medium mt-0.5">{receiptData.receipt.paidDate}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => onDownloadTextReceipt(receiptData.feeRecord)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" /> Download Receipt
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold"
                >
                  <Receipt className="w-3.5 h-3.5" /> Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
