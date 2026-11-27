import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Mail, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import { MessageItem, NotificationItem } from '../types/index.ts';
import { EmptyState, useToast } from './ui/ToastAndModal.tsx';

export const NotificationsView: React.FC<{
  notifications: NotificationItem[];
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
}> = ({ notifications, onRefresh, onNavigateTab }) => {
  const { showToast } = useToast();

  const markOneRead = async (id: number) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      onRefresh();
    } catch (err: any) {
      showToast('Failed to update', err?.message, 'error');
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      showToast('All caught up', 'All notifications marked as read.');
      onRefresh();
    } catch (err: any) {
      showToast('Failed to update', err?.message, 'error');
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Notifications
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {unreadCount > 0
              ? `${unreadCount} unread updates`
              : 'You are all caught up'}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 self-start whitespace-nowrap"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-6 h-6" />}
          title="You’re all caught up!"
          description="Alerts for newly uploaded marks, homework, attendance, and school notices appear here."
        />
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                !n.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[var(--sc-primary)] dark:text-blue-400">
                    {n.type}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                  {!n.isRead && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                        Unread
                      </span>
                    </>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {n.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {n.message}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {n.linkTab && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.isRead) markOneRead(n.id);
                      onNavigateTab(n.linkTab!);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    Open
                  </button>
                )}
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => markOneRead(n.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--sc-primary)] text-white whitespace-nowrap"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const MessagesView: React.FC = () => {
  const { user, selectedChild } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [contacts, setContacts] = useState<Array<{ id: number; fullName: string; role: string }>>([]);
  const [recipientId, setRecipientId] = useState<number>(0);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const loadMessages = async () => {
    try {
      const res = await apiFetch<{
        messages: MessageItem[];
        contacts: Array<{ id: number; fullName: string; role: string }>;
      }>('/api/messages');
      setMessages(res.messages);
      setContacts(res.contacts);
      if (res.contacts[0] && !recipientId) {
        setRecipientId(res.contacts[0].id);
      }
    } catch (err: any) {
      showToast('Failed to load messages', err?.message, 'error');
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId) return;
    setSending(true);
    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipientId,
          studentId: selectedChild?.id,
          subject,
          body,
        }),
      });
      showToast('Message Sent', 'Your message has been delivered securely.');
      setSubject('');
      setBody('');
      loadMessages();
    } catch (err: any) {
      showToast('Send Failed', err?.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Parent–Teacher Communication
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Direct, audited messaging between families and faculty
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSend}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 self-start"
        >
          <h3 className="text-sm font-semibold">New Message</h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Recipient
            </label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Progress check-in"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Message
            </label>
            <textarea
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={sending || contacts.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[var(--sc-primary)] text-white text-sm font-semibold disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </form>

        <div className="lg:col-span-2 space-y-3">
          {messages.length === 0 ? (
            <EmptyState
              icon={<Mail className="w-6 h-6" />}
              title="No messages yet"
              description="Start a conversation with your child’s subject teacher or parent contact."
            />
          ) : (
            messages.map((m) => {
              const isMine = m.senderId === user?.id;
              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {isMine ? `To: ${m.recipientName}` : `From: ${m.senderName}`} ·{' '}
                      {isMine ? m.recipientRole : m.senderRole}
                    </span>
                    <span className="font-mono">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {m.subject}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {m.body}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
