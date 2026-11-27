export interface AssistantNavAction {
  tabId: string;
  tabLabel: string;
  searchQuery?: string;
  roleFilter?: 'ALL' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';
  nonce?: number;
}

export interface EntryErrorEvent {
  id: string;
  title: string;
  message: string;
  fieldLabel?: string;
  pageContext?: string;
  timestamp: number;
}

type ErrorListener = (event: EntryErrorEvent) => void;
type NavListener = (action: AssistantNavAction) => void;

const entryErrorListeners = new Set<ErrorListener>();
const askAiForErrorListeners = new Set<ErrorListener>();
const navListeners = new Set<NavListener>();

let currentPageContext = 'Sign-In Page';
let latestEntryError: EntryErrorEvent | null = null;

export function setCurrentPageContext(ctx: string) {
  currentPageContext = ctx;
}

export function getCurrentPageContext(): string {
  return currentPageContext;
}

export function getLatestEntryError(): EntryErrorEvent | null {
  return latestEntryError;
}

export function emitEntryError(event: EntryErrorEvent) {
  latestEntryError = event;
  for (const listener of entryErrorListeners) {
    listener(event);
  }
}

export function subscribeEntryError(listener: ErrorListener): () => void {
  entryErrorListeners.add(listener);
  return () => {
    entryErrorListeners.delete(listener);
  };
}

export function emitAskAiForError(event: EntryErrorEvent) {
  latestEntryError = event;
  for (const listener of askAiForErrorListeners) {
    listener(event);
  }
}

export function subscribeAskAiForError(listener: ErrorListener): () => void {
  askAiForErrorListeners.add(listener);
  return () => {
    askAiForErrorListeners.delete(listener);
  };
}

export function emitNavigateAction(action: AssistantNavAction) {
  const withNonce: AssistantNavAction = {
    ...action,
    nonce: action.nonce ?? Date.now() + Math.random(),
  };
  for (const listener of navListeners) {
    listener(withNonce);
  }
}

export function subscribeNavigateAction(listener: NavListener): () => void {
  navListeners.add(listener);
  return () => {
    navListeners.delete(listener);
  };
}
