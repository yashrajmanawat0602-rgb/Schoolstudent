import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  apiFetch,
  getMemoryAuthToken,
  setFirebaseTokenProvider,
  setMemoryAuthToken,
} from '../services/api.ts';
import {
  FirestoreUserProfile,
  subscribeUserProfile,
  syncUserProfileToFirestore,
  updateUserPreferencesInFirestore,
} from '../services/firestoreService.ts';
import {
  AuthUser,
  ChildSummary,
  SchoolSettings,
  SessionContextData,
  TeacherClassAssignment,
  ThemeMode,
} from '../types/index.ts';

interface AuthContextValue {
  user: AuthUser | null;
  firebaseUser: FirebaseUser | null;
  firebaseProfile: FirestoreUserProfile | null;
  children: ChildSummary[];
  selectedChild: ChildSummary | null;
  setSelectedChildId: (id: number) => void;
  studentProfile: Omit<ChildSummary, 'relationship'> | null;
  teacherClasses: TeacherClassAssignment[];
  schoolSettings: SchoolSettings | null;
  refreshSession: () => Promise<void>;
  refreshSchoolSettings: () => Promise<void>;
  loginWithPassword: (
    identifier: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applySchoolThemeVariables(settings: SchoolSettings | null, mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('theme-school');
  } else if (mode === 'school') {
    root.classList.remove('dark');
    root.classList.add('theme-school');
  } else {
    root.classList.remove('dark', 'theme-school');
  }

  if (settings) {
    root.style.setProperty('--sc-primary', settings.primaryColor || '#1e3a8a');
    root.style.setProperty('--sc-secondary', settings.secondaryColor || '#0f172a');
    root.style.setProperty('--sc-accent', settings.accentColor || '#d97706');
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children: nodeChildren,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseProfile, setFirebaseProfile] = useState<FirestoreUserProfile | null>(null);
  const [childrenList, setChildrenList] = useState<ChildSummary[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [studentProfile, setStudentProfile] =
    useState<Omit<ChildSummary, 'relationship'> | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClassAssignment[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  const themeRef = useRef<ThemeMode>(themeMode);
  useEffect(() => {
    themeRef.current = themeMode;
    applySchoolThemeVariables(schoolSettings, themeMode);
  }, [schoolSettings, themeMode]);

  const applySessionData = useCallback((data: SessionContextData) => {
    setUser(data.user);
    setChildrenList(data.children || []);
    setSelectedChildId((prev) => {
      if (prev && data.children?.some((c) => c.id === prev)) return prev;
      return data.children?.[0]?.id || null;
    });
    setStudentProfile(data.studentProfile || null);
    setTeacherClasses(data.teacherClasses || []);
    if (data.schoolSettings) {
      setSchoolSettings(data.schoolSettings);
    }
  }, []);

  const refreshSchoolSettings = useCallback(async () => {
    try {
      const settings = await apiFetch<SchoolSettings | null>('/api/school/settings');
      if (settings) setSchoolSettings(settings);
    } catch {
      // Ignore transient error on public branding fetch
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const data = await apiFetch<SessionContextData>('/api/auth/me');
    applySessionData(data);
  }, [applySessionData]);

  const exchangeFirebaseToken = useCallback(
    async (fbUser: FirebaseUser) => {
      const idToken = await fbUser.getIdToken();
      const data = await apiFetch<SessionContextData & { token: string }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      setMemoryAuthToken(data.token);
      applySessionData(data);
    },
    [applySessionData]
  );

  useEffect(() => {
    setFirebaseTokenProvider(async () => {
      if (auth.currentUser) {
        return auth.currentUser.getIdToken();
      }
      return null;
    });

    let unsubProfile: (() => void) | null = null;
    let initialSettled = false;

    const finishLoading = () => {
      if (!initialSettled) {
        initialSettled = true;
        setLoading(false);
      }
    };

    void refreshSchoolSettings();

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setFirebaseUser(fbUser);

      if (!fbUser) {
        setFirebaseProfile(null);
        finishLoading();
        return;
      }

      try {
        if (!getMemoryAuthToken()) {
          await exchangeFirebaseToken(fbUser);
        }

        if (fbUser.emailVerified && fbUser.email) {
          await syncUserProfileToFirestore({
            uid: fbUser.uid,
            displayName: fbUser.displayName || fbUser.email.split('@')[0] || 'Portal User',
            email: fbUser.email,
            photoUrl: fbUser.photoURL,
            themeMode: themeRef.current,
          });

          unsubProfile = subscribeUserProfile(
            fbUser.uid,
            (profile) => {
              setFirebaseProfile(profile);
              if (profile?.themeMode && ['light', 'dark', 'school'].includes(profile.themeMode)) {
                setThemeModeState(profile.themeMode);
              }
            },
            (err) => {
              console.warn('Firestore profile listener error:', err.message);
            }
          );
        }
      } catch (err) {
        console.warn('Firebase auth sync notice:', err);
      } finally {
        finishLoading();
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, [exchangeFirebaseToken, refreshSchoolSettings]);

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      setThemeModeState(mode);
      if (firebaseUser?.uid && firebaseUser.emailVerified) {
        void updateUserPreferencesInFirestore(firebaseUser.uid, { themeMode: mode }).catch(
          (err) => {
            console.warn('Unable to persist theme preference to Firestore:', err);
          }
        );
      }
    },
    [firebaseUser]
  );

  const loginWithPassword = async (
    identifier: string,
    password: string,
    rememberMe = false
  ) => {
    const data = await apiFetch<SessionContextData & { token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, rememberMe }),
    });
    setMemoryAuthToken(data.token);
    applySessionData(data);
  };

  const loginWithGoogle = async () => {
    const credential = await signInWithPopup(auth, googleAuthProvider);
    await exchangeFirebaseToken(credential.user);
    if (credential.user.emailVerified && credential.user.email) {
      await syncUserProfileToFirestore({
        uid: credential.user.uid,
        displayName:
          credential.user.displayName ||
          credential.user.email.split('@')[0] ||
          'Portal User',
        email: credential.user.email,
        photoUrl: credential.user.photoURL,
        themeMode: themeRef.current,
      });
    }
  };

  const logout = async () => {
    setMemoryAuthToken(null);
    setUser(null);
    setChildrenList([]);
    setSelectedChildId(null);
    setStudentProfile(null);
    setTeacherClasses([]);
    setFirebaseProfile(null);
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
  };

  const selectedChild =
    childrenList.find((c) => c.id === selectedChildId) || childrenList[0] || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        firebaseProfile,
        children: childrenList,
        selectedChild,
        setSelectedChildId,
        studentProfile,
        teacherClasses,
        schoolSettings,
        refreshSession,
        refreshSchoolSettings,
        loginWithPassword,
        loginWithGoogle,
        logout,
        loading,
        themeMode,
        setThemeMode,
      }}
    >
      {nodeChildren}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
