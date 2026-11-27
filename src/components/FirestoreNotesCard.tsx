import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Cloud,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  createUserNote,
  deleteUserNote,
  FirestoreUserNote,
  NoteCategory,
  subscribeUserNotes,
  toggleUserNoteCompleted,
} from '../services/firestoreService.ts';
import { useToast } from './ui/ToastAndModal.tsx';

export const FirestoreNotesCard: React.FC = () => {
  const { firebaseUser, loginWithGoogle } = useAuth();
  const { showToast } = useToast();

  const [notes, setNotes] = useState<FirestoreUserNote[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>('STUDY');
  const [saving, setSaving] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser?.uid) {
      setNotes([]);
      return;
    }

    setFirestoreError(null);
    const unsub = subscribeUserNotes(
      firebaseUser.uid,
      (items) => setNotes(items),
      (err) => {
        setFirestoreError(err.message);
      }
    );

    return () => unsub();
  }, [firebaseUser?.uid]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser?.uid || !title.trim() || saving) return;

    setSaving(true);
    try {
      await createUserNote(firebaseUser.uid, {
        title: title.trim(),
        content: content.trim(),
        category,
      });
      setTitle('');
      setContent('');
      showToast('Saved to Firestore', 'Your personal study note is synced.');
    } catch (err: any) {
      showToast('Save Failed', err?.message || 'Unable to save note.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      await loginWithGoogle();
      showToast('Google Account Connected', 'Cloud sync is now active.');
    } catch (err: any) {
      showToast('Google Sign-In Failed', err?.message || 'Unable to sign in with Google.', 'error');
    } finally {
      setConnectingGoogle(false);
    }
  };

  if (!firebaseUser) {
    return (
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Cloud className="w-4 h-4 text-[var(--sc-primary)] dark:text-blue-400" />
            Cloud-Synced Personal Study Notes &amp; Reminders
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Connect with Google Sign-In to save personal reminders, study notes, and theme preferences across devices with Firestore.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleConnectGoogle()}
          disabled={connectingGoogle}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 disabled:opacity-60"
        >
          {connectingGoogle ? 'Connecting...' : 'Connect Google Sync'}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-600" />
            Personal Cloud Notes &amp; Reminders
          </h2>
          <p className="text-xs text-slate-500">
            Synced in real time with Firestore for {firebaseUser.email}
          </p>
        </div>
        <span className="font-mono text-xs text-slate-500">{notes.length} saved</span>
      </div>

      {firestoreError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 break-words">
          {firestoreError}
        </div>
      )}

      <form onSubmit={(e) => void handleCreate(e)} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <input
          type="text"
          required
          maxLength={140}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a reminder or study note..."
          className="sm:col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--sc-primary)]"
        />
        <input
          type="text"
          maxLength={2000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Details (optional)..."
          className="sm:col-span-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--sc-primary)]"
        />
        <select
          aria-label="Note category"
          value={category}
          onChange={(e) => setCategory(e.target.value as NoteCategory)}
          className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
        >
          <option value="STUDY">Study</option>
          <option value="HOMEWORK">Homework</option>
          <option value="REMINDER">Reminder</option>
          <option value="SUPPORT">Support</option>
        </select>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="sm:col-span-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[var(--sc-primary)] text-white px-3 py-2 text-xs font-semibold hover:opacity-95 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="sm:hidden">Save</span>
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">
          No cloud notes saved yet. Add one above to persist it to Firestore.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {notes.map((note) => (
            <div key={note.id} className="py-2.5 flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => void toggleUserNoteCompleted(note.id, !note.completed)}
                className="flex items-start gap-2.5 text-left min-w-0 flex-1"
              >
                {note.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div
                    className={`text-sm font-medium ${
                      note.completed
                        ? 'line-through text-slate-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {note.title}
                  </div>
                  {note.content && (
                    <div className="text-xs text-slate-500 mt-0.5 break-words">{note.content}</div>
                  )}
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {note.category}
                  </div>
                </div>
              </button>
              <button
                type="button"
                aria-label={`Delete ${note.title}`}
                onClick={() => void deleteUserNote(note.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
