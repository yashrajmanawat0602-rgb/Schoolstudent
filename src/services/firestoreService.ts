import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { ThemeMode } from '../types/index.ts';

// Synchronized verbatim with firebase-blueprint.json constraints
const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_DISPLAY_NAME_LEN = 120;
const MAX_EMAIL_LEN = 160;
const MAX_LANG_LEN = 32;
const MAX_TAB_LEN = 64;
const MAX_PHOTO_URL_LEN = 500;
const MAX_NOTE_TITLE_LEN = 140;
const MAX_NOTE_CONTENT_LEN = 2000;

export type NoteCategory = 'STUDY' | 'HOMEWORK' | 'REMINDER' | 'SUPPORT';

export interface FirestoreUserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT' | 'PORTAL_USER';
  themeMode: ThemeMode;
  preferredLanguage?: string;
  lastVisitedTab?: string;
  notificationsEnabled: boolean;
  photoUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FirestoreUserNote {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  category: NoteCategory;
  completed: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

function assertValidId(id: string, fieldName: string) {
  if (!id || id.length > 128 || !VALID_ID_REGEX.test(id)) {
    throw new Error(`Invalid ${fieldName} identifier.`);
  }
}

function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  return Date.now();
}

export async function syncUserProfileToFirestore(params: {
  uid: string;
  displayName: string;
  email: string;
  photoUrl?: string | null;
  themeMode: ThemeMode;
}): Promise<void> {
  assertValidId(params.uid, 'uid');
  const docPath = `userProfiles/${params.uid}`;
  const ref = doc(db, 'userProfiles', params.uid);

  const safeDisplayName = clampString(params.displayName || 'Portal User', MAX_DISPLAY_NAME_LEN);
  const safeEmail = clampString(params.email, MAX_EMAIL_LEN);
  const safePhotoUrl = params.photoUrl ? clampString(params.photoUrl, MAX_PHOTO_URL_LEN) : undefined;
  const safeTheme: ThemeMode = ['light', 'dark', 'school'].includes(params.themeMode)
    ? params.themeMode
    : 'light';

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, docPath);
  }

  if (!existingSnap.exists()) {
    const initialRole =
      safeEmail.toLowerCase() === 'yashrajmanawat0602@gmail.com' ? 'ADMIN' : 'PORTAL_USER';
    const payload: Record<string, unknown> = {
      uid: params.uid,
      displayName: safeDisplayName,
      email: safeEmail,
      role: initialRole,
      themeMode: safeTheme,
      notificationsEnabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (safePhotoUrl) {
      payload.photoUrl = safePhotoUrl;
    }

    try {
      await setDoc(ref, payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, docPath);
    }
    return;
  }

  const updatePayload: Record<string, unknown> = {
    displayName: safeDisplayName,
    email: safeEmail,
    updatedAt: serverTimestamp(),
  };
  if (safePhotoUrl) {
    updatePayload.photoUrl = safePhotoUrl;
  }

  try {
    await updateDoc(ref, updatePayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, docPath);
  }
}

export function subscribeUserProfile(
  uid: string,
  onProfile: (profile: FirestoreUserProfile | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  assertValidId(uid, 'uid');
  const docPath = `userProfiles/${uid}`;
  const ref = doc(db, 'userProfiles', uid);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onProfile(null);
        return;
      }
      onProfile(snap.data() as FirestoreUserProfile);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, docPath);
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

export async function updateUserPreferencesInFirestore(
  uid: string,
  patch: {
    themeMode?: ThemeMode;
    preferredLanguage?: string;
    lastVisitedTab?: string;
    notificationsEnabled?: boolean;
  }
): Promise<void> {
  assertValidId(uid, 'uid');
  const docPath = `userProfiles/${uid}`;
  const ref = doc(db, 'userProfiles', uid);

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (patch.themeMode && ['light', 'dark', 'school'].includes(patch.themeMode)) {
    payload.themeMode = patch.themeMode;
  }
  if (typeof patch.preferredLanguage === 'string') {
    payload.preferredLanguage = clampString(patch.preferredLanguage, MAX_LANG_LEN);
  }
  if (typeof patch.lastVisitedTab === 'string') {
    payload.lastVisitedTab = clampString(patch.lastVisitedTab, MAX_TAB_LEN);
  }
  if (typeof patch.notificationsEnabled === 'boolean') {
    payload.notificationsEnabled = patch.notificationsEnabled;
  }

  try {
    await updateDoc(ref, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, docPath);
  }
}

export function subscribeUserNotes(
  uid: string,
  onNotes: (notes: FirestoreUserNote[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  assertValidId(uid, 'uid');
  const path = 'userNotes';
  const q = query(collection(db, path), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestoreUserNote[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId || ''),
          title: String(data.title || ''),
          content: String(data.content || ''),
          category: (data.category as NoteCategory) || 'STUDY',
          completed: Boolean(data.completed),
          createdAtMs: timestampToMs(data.createdAt),
          updatedAtMs: timestampToMs(data.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onNotes(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

export async function createUserNote(
  uid: string,
  input: {
    title: string;
    content: string;
    category: NoteCategory;
  }
): Promise<string> {
  assertValidId(uid, 'uid');
  const safeTitle = clampString(input.title, MAX_NOTE_TITLE_LEN);
  const safeContent = clampString(input.content || '', MAX_NOTE_CONTENT_LEN);
  const safeCategory: NoteCategory = ['STUDY', 'HOMEWORK', 'REMINDER', 'SUPPORT'].includes(
    input.category
  )
    ? input.category
    : 'STUDY';

  if (!safeTitle) {
    throw new Error('Note title is required.');
  }

  const newDocRef = doc(collection(db, 'userNotes'));
  const docPath = `userNotes/${newDocRef.id}`;

  try {
    await setDoc(newDocRef, {
      ownerId: uid,
      title: safeTitle,
      content: safeContent,
      category: safeCategory,
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newDocRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, docPath);
  }
}

export async function toggleUserNoteCompleted(
  noteId: string,
  completed: boolean
): Promise<void> {
  assertValidId(noteId, 'noteId');
  const docPath = `userNotes/${noteId}`;
  try {
    await updateDoc(doc(db, 'userNotes', noteId), {
      completed: Boolean(completed),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, docPath);
  }
}

export async function updateUserNoteContent(
  noteId: string,
  input: {
    title: string;
    content: string;
    category: NoteCategory;
  }
): Promise<void> {
  assertValidId(noteId, 'noteId');
  const safeTitle = clampString(input.title, MAX_NOTE_TITLE_LEN);
  const safeContent = clampString(input.content || '', MAX_NOTE_CONTENT_LEN);
  const safeCategory: NoteCategory = ['STUDY', 'HOMEWORK', 'REMINDER', 'SUPPORT'].includes(
    input.category
  )
    ? input.category
    : 'STUDY';

  if (!safeTitle) {
    throw new Error('Note title is required.');
  }

  const docPath = `userNotes/${noteId}`;
  try {
    await updateDoc(doc(db, 'userNotes', noteId), {
      title: safeTitle,
      content: safeContent,
      category: safeCategory,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, docPath);
  }
}

export async function deleteUserNote(noteId: string): Promise<void> {
  assertValidId(noteId, 'noteId');
  const docPath = `userNotes/${noteId}`;
  try {
    await deleteDoc(doc(db, 'userNotes', noteId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, docPath);
  }
}
