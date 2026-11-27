import React, { useRef, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  BookOpen,
  CalendarCheck,
  Camera,
  CreditCard,
  Cuboid,
  Eye,
  EyeOff,
  GraduationCap,
  IdCard,
  Lock,
  Moon,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sun,
  Video,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import {
  CampusCameraPreset,
  HERO_PALETTES,
  HeroPaletteId,
  SchoolHero3DCanvas,
} from './SchoolHero3DCanvas.tsx';
import { useToast } from './ui/ToastAndModal.tsx';

export const LoginView: React.FC = () => {
  const {
    loginWithPassword,
    loginWithGoogle,
    schoolSettings,
    themeMode,
    setThemeMode,
  } = useAuth();
  const { showToast } = useToast();

  const identifierInputRef = useRef<HTMLInputElement | null>(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');

  // 3D Campus Interactive Controls
  const [paletteId, setPaletteId] = useState<HeroPaletteId>('daylight-campus');
  const [cameraPreset, setCameraPreset] = useState<CampusCameraPreset>('overview');
  const [showPhotoMode, setShowPhotoMode] = useState(false);
  const [autoOrbit, setAutoOrbit] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);
  const [roleGuidance, setRoleGuidance] = useState<string>('');

  const schoolName = schoolSettings?.schoolName || 'Macro Vision Academy Burhanpur';
  const logoSrc =
    schoolSettings?.logoUrl ||
    '/assets/aistudio/Screenshot_2026-11-21_at_5.47.20_PM_a4b44a58.png';

  const focusSignIn = (hint?: string) => {
    if (hint) setRoleGuidance(hint);
    const el = identifierInputRef.current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => el.focus(), 250);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setGoogleSubmitting(true);
    try {
      await loginWithGoogle();
      showToast('Signed in with Google', 'Redirecting to your dashboard.');
    } catch (err: any) {
      const msg =
        err?.code === 'auth/popup-closed-by-user'
          ? 'Google sign-in popup was closed before completion.'
          : err?.message || 'Unable to complete Google Sign-In.';
      setErrorMsg(msg);
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (identifier.includes('@')) {
      setErrorMsg(
        'Email and Gmail login are disabled. Please sign in using your issued Username or School ID.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await loginWithPassword(identifier.trim(), password, rememberMe);
      showToast('Signed in successfully', 'Redirecting to your dashboard.');
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Unable to authenticate. Please verify your credentials.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier: forgotIdentifier }),
      });
      showToast('Reset Request Submitted', res.message, 'info');
      setForgotOpen(false);
      setForgotIdentifier('');
    } catch (err: any) {
      showToast(
        'Reset Request Failed',
        err?.message || 'Enter your Username or School ID.',
        'error'
      );
    }
  };

  return (
    <div
      id="top"
      className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 selection:bg-amber-400 selection:text-slate-950"
    >
      {/* Top Bar Contract: 3 Clean Zones (Brand — 4 Single-Line Links — 1 Primary Action) */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#090E1A]/95">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="inline-flex items-center gap-2.5 text-base sm:text-lg font-bold tracking-tight whitespace-nowrap shrink-0 text-slate-900 dark:text-white"
          >
            <img
              src={logoSrc}
              alt={schoolName}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-md object-contain bg-white p-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <span>{schoolName}</span>
          </a>

          <nav
            aria-label="Primary landing navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <a
              href="#portals"
              className="hover:text-[#1E3A8A] dark:hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Portals
            </a>
            <a
              href="#academics"
              className="hover:text-[#1E3A8A] dark:hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Academics
            </a>
            <a
              href="#online-fees"
              className="hover:text-[#1E3A8A] dark:hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Online Fees
            </a>
            <a
              href="#campus"
              className="hover:text-[#1E3A8A] dark:hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Campus
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => focusSignIn()}
              className="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#1E3A8A] text-white hover:bg-[#172E6E] dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Portal Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Stage: Crisp Ivory & Sapphire Academic Theme + Detailed 3D Campus Replica */}
      <section className="relative bg-gradient-to-b from-[#EFF5FF] via-[#F8FAFC] to-[#FFFFFF] dark:from-[#0B1633] dark:via-[#091124] dark:to-[#070B14] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Left Column: Clean Editorial Headline + Unobstructed 3D Campus Replica */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-5">
              <div>
                <p className="text-xs sm:text-sm font-semibold text-[#1E3A8A] dark:text-amber-300">
                  Academic Year {schoolSettings?.currentAcademicYear || '2026-2027'}
                  <span aria-hidden="true" className="mx-2 text-slate-400">
                    ·
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    Burhanpur Campus Portal
                  </span>
                </p>
                <h1 className="mt-2 text-[clamp(2rem,3.4vw,2.9rem)] font-bold tracking-tight leading-[1.12] text-balance text-slate-900 dark:text-white">
                  Everything about your child’s school journey — in one place.
                </h1>
                <p className="mt-2.5 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  Explore the 3D replica of our campus complex — drag to orbit, zoom in
                  on the main block, courtyard buses, or marble dome — and sign in right beside it.
                </p>
              </div>

              {/* Unobstructed 3D Campus Replica Viewport */}
              <div className="relative flex-1 min-h-[360px] sm:min-h-[420px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
                <div className="absolute inset-0 z-0">
                  <SchoolHero3DCanvas
                    paletteId={paletteId}
                    cameraPreset={cameraPreset}
                    autoOrbit={autoOrbit}
                    resetSignal={resetSignal}
                    showPhotoMode={showPhotoMode}
                  />
                </div>

                {/* Top-Left Camera Angle Switcher (Compact, Zero Center Occlusion, No backdrop-blur) */}
                <div className="relative z-10 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                  {!showPhotoMode ? (
                    <div
                      role="group"
                      aria-label="3D campus camera views"
                      className="pointer-events-auto inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white/95 dark:bg-[#0B1633]/95 border border-slate-200 dark:border-white/15 shadow-sm"
                    >
                      {(
                        [
                          { id: 'overview', label: 'Aerial View' },
                          { id: 'main-block', label: 'Main Block' },
                          { id: 'west-wing', label: 'West Wings' },
                          { id: 'courtyard', label: 'Gate & Buses' },
                          { id: 'dome', label: 'Marble Dome' },
                        ] as const
                      ).map((view) => (
                        <button
                          key={view.id}
                          type="button"
                          onClick={() => {
                            setCameraPreset(view.id);
                            setResetSignal((n) => n + 1);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            cameraPreset === view.id
                              ? 'bg-[#1E3A8A] text-white dark:bg-amber-400 dark:text-slate-950'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                          }`}
                        >
                          {view.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="pointer-events-auto px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#0B1633]/95 border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-sm">
                      Aerial Campus Photograph
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowPhotoMode((v) => !v)}
                    className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#0B1633]/95 border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#13234E] shadow-sm transition-colors whitespace-nowrap shrink-0"
                  >
                    {showPhotoMode ? (
                      <>
                        <Cuboid className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-amber-300" />
                        <span>View 3D Model</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-amber-300" />
                        <span>Campus Photo</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Compact Bottom 3D Dock */}
                {!showPhotoMode && (
                  <div className="relative z-10 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
                    <div
                      role="group"
                      aria-label="3D campus lighting"
                      className="pointer-events-auto inline-flex items-center gap-1 p-1 rounded-xl bg-white/95 dark:bg-[#0B1633]/95 border border-slate-200 dark:border-white/15 shadow-sm"
                    >
                      {(Object.keys(HERO_PALETTES) as HeroPaletteId[]).map((pid) => {
                        const pal = HERO_PALETTES[pid];
                        const selected = paletteId === pid;
                        return (
                          <button
                            key={pid}
                            type="button"
                            onClick={() => setPaletteId(pid)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                              selected
                                ? 'bg-[#1E3A8A] text-white dark:bg-amber-400 dark:text-slate-950'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-white/30 shrink-0"
                              style={{ backgroundColor: pal.swatchSky }}
                            />
                            <span>{pal.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pointer-events-auto inline-flex items-center gap-1 p-1 rounded-xl bg-white/95 dark:bg-[#0B1633]/95 border border-slate-200 dark:border-white/15 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setAutoOrbit((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
                      >
                        {autoOrbit ? (
                          <>
                            <Pause className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-amber-300" />
                            <span>Pause Spin</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-amber-300" />
                            <span>Auto Spin</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCameraPreset('overview');
                          setResetSignal((n) => n + 1);
                        }}
                        aria-label="Reset 3D camera angle"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-amber-300" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Integrated Portal Sign-In Card */}
            <div className="lg:col-span-5 flex items-center">
              <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 p-6 sm:p-8 shadow-sm space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Portal Sign In
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Sign in with your assigned Username or School ID.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setThemeMode(themeMode === 'dark' ? 'light' : 'dark')
                    }
                    aria-label="Toggle color theme"
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                  >
                    {themeMode === 'dark' ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-[#1E3A8A]" />
                    )}
                  </button>
                </div>

                {roleGuidance && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                    {roleGuidance}
                  </div>
                )}

                {errorMsg && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300"
                  >
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="auth-identifier"
                      className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Username / School ID
                    </label>
                    <div className="relative">
                      <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        ref={identifierInputRef}
                        id="auth-identifier"
                        type="text"
                        required
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="e.g. PAR-10A-001 or STU-10A-001"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-amber-400"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                      For Parents, Students, Teachers, and Administrators (email login is disabled).
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="auth-password"
                      className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-slate-300 text-[#1E3A8A]"
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="font-medium text-[#1E3A8A] dark:text-amber-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || googleSubmitting}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-[#1E3A8A] hover:bg-[#172E6E] dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300 disabled:opacity-60 transition-colors"
                  >
                    {submitting ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                <div className="relative flex items-center py-0.5">
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                  <span className="mx-3 shrink text-xs text-slate-400">or</span>
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                </div>

                <button
                  type="button"
                  onClick={() => void handleGoogleLogin()}
                  disabled={submitting || googleSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5 disabled:opacity-60 transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  {googleSubmitting ? 'Connecting to Google...' : 'Continue with Google'}
                </button>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Role-Protected Access
                  </span>
                  <span>Admin · Teacher · Parent · Student</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Grounded Metrics Strip below Hero Split */}
          <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#1E3A8A] dark:text-amber-300">
                4 Portals
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Admin, Class Teacher, Parent &amp; Student workspaces
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                0% Fee
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Direct PhonePe, Google Pay &amp; UPI QR fee checkout
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                Up to 2 GB
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                HD student activity videos and campus showcases
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                Real-Time
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Attendance calendars, marks reports &amp; AI navigation
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: Asymmetric Editorial Showcase of School Portals & Campus Life */}
      <section id="portals" className="py-16 lg:py-20 max-w-7xl mx-auto px-5 sm:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#1E3A8A] dark:text-amber-400">
              Connected Academic Ecosystem
            </p>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-balance text-slate-900 dark:text-white">
              One unified portal built for families, teachers, and students.
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
            Select your role below to jump straight to sign-in with your assigned School ID.
          </p>
        </div>

        <div id="academics" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Card 01 (Wide 7-col featured card) */}
          <div className="lg:col-span-7 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-white min-h-[320px] flex flex-col justify-end group">
            <img
              src="/src/assets/images/gallery_science_fair_1795258860582.jpg"
              alt="Students presenting STEM models at campus exhibition"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/20" />
            <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="max-w-lg">
                <div className="text-xs font-medium text-amber-300 flex items-center gap-2">
                  <span>01. Parent &amp; Student Hub</span>
                  <span aria-hidden="true">·</span>
                  <span>Marks, Homework &amp; Activity Reels</span>
                </div>
                <h3 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight">
                  Track every milestone, grade, and classroom activity
                </h3>
                <p className="mt-2 text-sm text-slate-200 leading-relaxed">
                  View live exam marks, attendance streaks, homework deadlines, and
                  high-definition student activity videos uploaded by class teachers.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  focusSignIn(
                    'Parent & Student accounts sign in with their issued ID (such as PAR-10A-001 or STU-10A-001).'
                  )
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <span>Open Family Sign In</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 02 (5-col card) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#1E3A8A]/10 dark:bg-amber-400/15 text-[#1E3A8A] dark:text-amber-300 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="mt-5 text-xs font-medium text-slate-500 dark:text-slate-400">
                02. Class Teacher &amp; Faculty Workspace
              </div>
              <h3 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Manage assigned classes with full student profiles
              </h3>
              <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Class teachers access only their admin-assigned sections to mark daily
                attendance, publish exam scores, share study notes, and upload up to
                2 GB activity videos per student.
              </p>
            </div>
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Attendance
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Video className="w-3.5 h-3.5 text-amber-600" />
                  Media Uploads
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  focusSignIn(
                    'Teachers sign in using their assigned faculty username to manage their class roster.'
                  )
                }
                className="text-xs font-semibold text-[#1E3A8A] dark:text-amber-400 hover:underline whitespace-nowrap shrink-0"
              >
                Faculty Sign In
              </button>
            </div>
          </div>

          {/* Card 03 (5-col card) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div className="mt-5 text-xs font-medium text-slate-500 dark:text-slate-400">
                03. Smart Campus Search &amp; AI Navigator
              </div>
              <h3 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Instant page routing &amp; form assistance
              </h3>
              <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Find timetables, notes, fee statements, or student records in seconds
                using the built-in AI assistant that guides you directly to the page
                and resolves data entry questions.
              </p>
            </div>
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-blue-400" />
                Notes Library · Timetables · Notices
              </span>
              <button
                type="button"
                onClick={() => focusSignIn()}
                className="text-xs font-semibold text-[#1E3A8A] dark:text-amber-400 hover:underline whitespace-nowrap shrink-0"
              >
                Get Started
              </button>
            </div>
          </div>

          {/* Card 04 (Wide 7-col campus showcase card) */}
          <div className="lg:col-span-7 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-white min-h-[300px] flex flex-col justify-end group">
            <img
              src="/src/assets/images/gallery_computer_lab_1795258859982.jpg"
              alt="Modern computer laboratory and digital learning center"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/20" />
            <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="max-w-lg">
                <div className="text-xs font-medium text-amber-300">
                  04. School Administration &amp; Governance
                </div>
                <h3 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight">
                  Complete control over classes, faculty, fees &amp; branding
                </h3>
                <p className="mt-2 text-sm text-slate-200 leading-relaxed">
                  Administrators configure class teachers, edit student and parent
                  enrollments, verify fee collections, and customize school branding.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  focusSignIn(
                    'Administrators sign in with their admin account to manage classes, faculty, and school UPI settings.'
                  )
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-slate-950 hover:bg-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <span>Admin Sign In</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Secure Online UPI & Gateway Fee Settlement */}
      <section
        id="online-fees"
        className="py-16 bg-gradient-to-br from-[#0B1633] via-[#10234E] to-[#081229] text-white border-y border-white/10"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-semibold text-amber-300">
              Verified School Fee Checkout
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              Pay school fees securely via PhonePe, Google Pay, Paytm, or UPI QR.
            </h2>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl">
              Parents sign in to review exact term fee breakdowns with pre-filled
              student details, scan a dynamically generated NPCI UPI QR code or tap
              their preferred payment app, verify the UTR reference, and download an
              official stamped receipt in seconds.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-slate-300">
              <span className="inline-flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-amber-300" />
                PhonePe · Google Pay · Paytm · BHIM UPI
              </span>
              <span className="inline-flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Debit / Credit Cards &amp; NetBanking
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/15 bg-white/5 p-5">
              <div className="text-xs text-slate-300">Server-Verified Amount</div>
              <div className="mt-2 text-lg font-bold font-mono tabular-nums text-amber-300">
                HMAC Signed
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Fee amounts are locked server-side per invoice.
              </p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-5">
              <div className="text-xs text-slate-300">Duplicate Protection</div>
              <div className="mt-2 text-lg font-bold font-mono tabular-nums text-emerald-300">
                Unique UTR
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Atomic ledger lock prevents double payments.
              </p>
            </div>
            <div className="col-span-2 rounded-xl border border-white/15 bg-white/5 p-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">
                  Ready to check or pay term fees?
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Sign in with your Parent ID to open the Fee Status portal.
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  focusSignIn(
                    'Sign in with your Parent School ID to open Fee Status & Online UPI Payment.'
                  )
                }
                className="px-4 py-2 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                Pay Fees
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Editorial Footer */}
      <footer
        id="campus"
        className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070B14] py-10"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img
              src={logoSrc}
              alt={schoolName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 border border-slate-200 dark:border-slate-700"
            />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {schoolName}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Academic Year {schoolSettings?.currentAcademicYear || '2026-2027'} · Burhanpur, Madhya Pradesh
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-400">
            <a href="#portals" className="hover:text-[#1E3A8A] dark:hover:text-amber-400">
              Portals
            </a>
            <a href="#academics" className="hover:text-[#1E3A8A] dark:hover:text-amber-400">
              Academics
            </a>
            <a href="#online-fees" className="hover:text-[#1E3A8A] dark:hover:text-amber-400">
              Online Fees
            </a>
            <button
              type="button"
              onClick={() => focusSignIn()}
              className="text-[#1E3A8A] dark:text-amber-400 font-semibold hover:underline"
            >
              Sign In
            </button>
          </div>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-base font-semibold">Reset Account Password</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Enter your assigned Username or School ID. Your school administrator will
              issue temporary reset credentials.
            </p>
            <form onSubmit={handleForgotSubmit} className="mt-4 space-y-4">
              <input
                type="text"
                required
                value={forgotIdentifier}
                onChange={(e) => setForgotIdentifier(e.target.value)}
                placeholder="Enter your Username or School ID"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#1E3A8A] text-white dark:bg-amber-400 dark:text-slate-950"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
