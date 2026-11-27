// In-memory auth token store (never stored in localStorage/sessionStorage for security)
let memoryAuthToken: string | null = null;
let firebaseTokenProvider: (() => Promise<string | null>) | null = null;

export function setMemoryAuthToken(token: string | null) {
  memoryAuthToken = token;
}

export function getMemoryAuthToken(): string | null {
  return memoryAuthToken;
}

export function setFirebaseTokenProvider(fn: (() => Promise<string | null>) | null) {
  firebaseTokenProvider = fn;
}

export class ApiError extends Error {
  status: number;
  validationErrors?: string[];

  constructor(message: string, status: number, validationErrors?: string[]) {
    super(message);
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

async function resolveBearerToken(): Promise<string | null> {
  if (memoryAuthToken) return memoryAuthToken;
  if (firebaseTokenProvider) {
    return firebaseTokenProvider();
  }
  return null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await resolveBearerToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : null;

  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) ||
      (res.status === 403
        ? 'You do not have permission to access this resource.'
        : res.status === 404
          ? 'The requested resource was not found.'
          : 'An unexpected server error occurred.');
    throw new ApiError(message, res.status, data?.validationErrors);
  }

  return data as T;
}

export async function downloadProtectedFile(url: string, fallbackName: string) {
  const token = await resolveBearerToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error('Unable to download file.');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function uploadStudentActivityMedia<T>(params: {
  studentId: number;
  file: File;
  title: string;
  description: string;
  activityDate: string;
  onProgress?: (progress: { percent: number; loaded: number; total: number }) => void;
  signal?: AbortSignal;
}): Promise<T> {
  const token = await resolveBearerToken();
  const formData = new FormData();
  formData.append('title', params.title);
  formData.append('description', params.description);
  formData.append('activityDate', params.activityDate);
  formData.append('media', params.file);

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/teacher/students/${params.studentId}/activities`);
    xhr.timeout = 0; // Allow large 1GB+ video uploads without client timeout

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    const onAbort = () => xhr.abort();
    if (params.signal) {
      if (params.signal.aborted) {
        reject(new ApiError('Upload cancelled.', 499));
        return;
      }
      params.signal.addEventListener('abort', onAbort, { once: true });
    }

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && params.onProgress) {
        const percent = Math.min(100, Math.round((ev.loaded / ev.total) * 100));
        params.onProgress({ percent, loaded: ev.loaded, total: ev.total });
      }
    };

    xhr.onload = () => {
      params.signal?.removeEventListener('abort', onAbort);
      let parsed: any = null;
      try {
        parsed = JSON.parse(xhr.responseText || '{}');
      } catch {
        parsed = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as T);
      } else {
        const msg =
          parsed?.error ||
          parsed?.message ||
          (xhr.status === 413
            ? 'File exceeds the 2 GB maximum upload limit.'
            : xhr.status === 403
              ? 'You are not authorized to upload activity media for this student.'
              : 'Failed to upload activity media.');
        reject(new ApiError(msg, xhr.status || 500));
      }
    };

    xhr.onerror = () => {
      params.signal?.removeEventListener('abort', onAbort);
      reject(new ApiError('Network error while uploading activity media.', 0));
    };

    xhr.onabort = () => {
      params.signal?.removeEventListener('abort', onAbort);
      reject(new ApiError('Upload cancelled.', 499));
    };

    xhr.send(formData);
  });
}
