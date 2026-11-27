import React, { useRef, useState } from 'react';
import {
  Camera,
  Download,
  Film,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, uploadStudentActivityMedia } from '../services/api.ts';
import { StudentActivityItem } from '../types/index.ts';
import { ConfirmDialog, useToast } from './ui/ToastAndModal.tsx';

export const MAX_ACTIVITY_MEDIA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB (supports minimum 1 GB+ uploads)

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

interface StudentActivitiesSectionProps {
  studentId: number;
  studentName: string;
  activities: StudentActivityItem[];
  canManage?: boolean;
  onChanged?: () => Promise<void> | void;
}

export const StudentActivitiesSection: React.FC<StudentActivitiesSectionProps> = ({
  studentId,
  studentName,
  activities,
  canManage = false,
  onChanged,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [title, setTitle] = useState('');
  const [activityDate, setActivityDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    percent: number;
    loaded: number;
    total: number;
  } | null>(null);

  const [lightboxItem, setLightboxItem] = useState<StudentActivityItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentActivityItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleFileSelected = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_ACTIVITY_MEDIA_BYTES) {
      showToast(
        'File Too Large',
        `"${file.name}" is ${formatFileSize(file.size)}. Maximum supported upload size is 2 GB.`,
        'error'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Media Required', 'Please choose a photo or video file to upload.', 'error');
      return;
    }
    if (description.trim().length < 3) {
      showToast(
        'Description Required',
        'Please write a short description of the activity performed by the student.',
        'error'
      );
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setUploading(true);
    setUploadProgress({ percent: 0, loaded: 0, total: selectedFile.size });

    try {
      await uploadStudentActivityMedia<StudentActivityItem>({
        studentId,
        file: selectedFile,
        title: title.trim() || 'Student Activity',
        description: description.trim(),
        activityDate,
        signal: controller.signal,
        onProgress: (p) => setUploadProgress(p),
      });

      setTitle('');
      setDescription('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowUploadForm(false);
      showToast(
        'Activity Media Uploaded',
        `Saved activity for ${studentName}. Student and parents can now view it.`
      );
      await onChanged?.();
    } catch (err: any) {
      if (err?.status !== 499) {
        showToast('Upload Failed', err?.message || 'Unable to upload activity media.', 'error');
      } else {
        showToast('Upload Cancelled', 'The file upload was cancelled.', 'info');
      }
    } finally {
      abortControllerRef.current = null;
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/teacher/activities/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      showToast('Activity Removed', `"${deleteTarget.title}" was deleted.`);
      setDeleteTarget(null);
      await onChanged?.();
    } catch (err: any) {
      showToast('Delete Failed', err?.message || 'Could not delete activity media.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Camera className="w-4 h-4 text-[var(--sc-primary)] dark:text-blue-400" />
            Student Activity Photos &amp; Videos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {canManage
              ? `Upload activity photos or videos for ${studentName} with descriptions (supports 1 GB+ files, up to 2 GB)`
              : `Photos and videos of activities performed by ${studentName}`}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowUploadForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" />
            {showUploadForm ? 'Close Upload Form' : 'Upload Photo / Video'}
          </button>
        )}
      </div>

      {canManage && showUploadForm && (
        <form
          onSubmit={handleUploadSubmit}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Activity Title *
              </label>
              <input
                type="text"
                required
                maxLength={140}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Science Fair Working Model Demo"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Activity Date *
              </label>
              <input
                type="date"
                required
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Activity Description *
            </label>
            <textarea
              rows={2}
              required
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Describe the activity ${studentName} performed...`}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Photo or Video File (Minimum 1 GB+ supported, up to 2 GB) *
            </label>
            <label className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-xs text-slate-600 dark:text-slate-300 cursor-pointer hover:border-[var(--sc-primary)] transition-colors">
              <span className="flex items-center gap-2 min-w-0">
                <Upload className="w-4 h-4 text-[var(--sc-primary)] shrink-0" />
                <span className="truncate font-medium">
                  {selectedFile
                    ? `${selectedFile.name} (${formatFileSize(selectedFile.size)})`
                    : 'Choose Photo (JPG, PNG, WEBP, HEIC) or Video (MP4, MOV, WEBM, MKV)'}
                </span>
              </span>
              <span className="text-[11px] font-mono text-slate-400 shrink-0">Max 2 GB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v,.heic,.heif"
                disabled={uploading}
                onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          {uploading && uploadProgress && (
            <div className="space-y-1.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/30 p-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-200">
                <span>
                  Uploading {formatFileSize(uploadProgress.loaded)} of{' '}
                  {formatFileSize(uploadProgress.total)}
                </span>
                <span className="font-mono font-semibold">{uploadProgress.percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-[var(--sc-primary)] transition-all duration-150"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {uploading ? (
              <button
                type="button"
                onClick={() => abortControllerRef.current?.abort()}
                className="px-3.5 py-2 rounded-lg border border-red-300 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                Cancel Upload
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="px-4 py-2 rounded-lg bg-[var(--sc-primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? 'Uploading Media...' : 'Save Activity Media'}
            </button>
          </div>
        </form>
      )}

      {activities.length === 0 ? (
        <div className="py-8 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          {canManage
            ? `No activity photos or videos uploaded for ${studentName} yet. Click "Upload Photo / Video" above to add one.`
            : `No activity photos or videos uploaded for ${studentName} yet.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/60 overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                {item.mediaType === 'VIDEO' ? (
                  <video
                    controls
                    preload="metadata"
                    src={item.mediaUrl}
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setLightboxItem(item)}
                    className="w-full h-full block group"
                    aria-label={`View ${item.title}`}
                  >
                    <img
                      src={item.mediaUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  </button>
                )}

                <span className="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/75 text-white text-[10px] font-semibold">
                  {item.mediaType === 'VIDEO' ? (
                    <>
                      <Film className="w-3 h-3" /> Video
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-3 h-3" /> Photo
                    </>
                  )}
                </span>
              </div>

              <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                    <span>{item.activityDate}</span>
                    <span>{formatFileSize(item.fileSizeBytes)}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="truncate">By {item.uploadedByName}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`${item.mediaUrl}&download=1`}
                      download={item.fileName}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        aria-label={`Delete ${item.title}`}
                        className="p-1.5 rounded border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {lightboxItem && lightboxItem.mediaType === 'IMAGE' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="w-full max-w-3xl rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-black flex items-center justify-center max-h-[70vh]">
              <img
                src={lightboxItem.mediaUrl}
                alt={lightboxItem.title}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
            <div className="p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500">
                  {lightboxItem.activityDate} · {formatFileSize(lightboxItem.fileSizeBytes)}
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-base font-bold">{lightboxItem.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {lightboxItem.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Delete Activity Media?"
          description={`Remove "${deleteTarget.title}" (${deleteTarget.fileName}) from ${studentName}'s profile?`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          destructive
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </section>
  );
};
