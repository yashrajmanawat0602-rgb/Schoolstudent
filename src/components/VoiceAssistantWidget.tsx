import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Compass,
  Loader2,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, getMemoryAuthToken } from '../services/api.ts';
import {
  AssistantNavAction,
  EntryErrorEvent,
  emitEntryError,
  emitNavigateAction,
  getCurrentPageContext,
  subscribeAskAiForError,
  subscribeEntryError,
} from '../services/assistantBus.ts';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  action?: AssistantNavAction | null;
}

type LiveStatus = 'idle' | 'connecting' | 'connected' | 'error';

function float32ToPcm16Base64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToPcm24kAudioBuffer(ctx: AudioContext, base64: string): AudioBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  const buffer = ctx.createBuffer(1, sampleCount, 24000);
  buffer.getChannelData(0).set(float32);
  return buffer;
}

export const VoiceAssistantWidget: React.FC = () => {
  const { user, schoolSettings } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentError, setRecentError] = useState<EntryErrorEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const widgetRootRef = useRef<HTMLDivElement | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const liveReadyRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const speakerMutedRef = useRef<boolean>(false);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    speakerMutedRef.current = speakerMuted;
  }, [speakerMuted]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Capture form HTML5 validation errors across the app
  useEffect(() => {
    let lastCapturedAt = 0;
    const handleInvalid = (event: Event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (!target || widgetRootRef.current?.contains(target)) return;
      const now = Date.now();
      if (now - lastCapturedAt < 700) return;
      lastCapturedAt = now;

      const labelText =
        target.getAttribute('aria-label') ||
        target.getAttribute('placeholder') ||
        target.name ||
        'Form field';
      const msg = target.validationMessage || 'Please enter a valid value.';
      emitEntryError({
        id: `invalid-${now}`,
        title: `Entry Error: ${labelText}`,
        message: msg,
        fieldLabel: labelText,
        pageContext: getCurrentPageContext(),
        timestamp: now,
      });
    };

    document.addEventListener('invalid', handleInvalid, true);
    return () => document.removeEventListener('invalid', handleInvalid, true);
  }, []);

  useEffect(() => {
    return subscribeEntryError((err) => {
      setRecentError(err);
    });
  }, []);

  const stopQueuedOutputAudio = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore stopped nodes
      }
    }
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setIsModelSpeaking(false);
  }, []);

  const stopLiveSession = useCallback(
    (nextStatus: LiveStatus = 'idle') => {
      liveReadyRef.current = false;
      setMicLevel(0);

      if (processorRef.current) {
        try {
          processorRef.current.onaudioprocess = null;
          processorRef.current.disconnect();
        } catch {
          // ignore
        }
        processorRef.current = null;
      }

      if (silentGainRef.current) {
        try {
          silentGainRef.current.disconnect();
        } catch {
          // ignore
        }
        silentGainRef.current = null;
      }

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }

      if (inputCtxRef.current) {
        void inputCtxRef.current.close().catch(() => {});
        inputCtxRef.current = null;
      }

      stopQueuedOutputAudio();

      if (outputCtxRef.current) {
        void outputCtxRef.current.close().catch(() => {});
        outputCtxRef.current = null;
      }

      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }

      setLiveStatus(nextStatus);
    },
    [stopQueuedOutputAudio]
  );

  useEffect(() => {
    return () => {
      stopLiveSession('idle');
    };
  }, [stopLiveSession]);

  const playAudioChunk = useCallback((base64Audio: string) => {
    if (speakerMutedRef.current) return;
    const outputCtx = outputCtxRef.current;
    if (!outputCtx) return;

    if (outputCtx.state === 'suspended') {
      void outputCtx.resume().catch(() => {});
    }

    const buffer = base64ToPcm24kAudioBuffer(outputCtx, base64Audio);
    if (buffer.length === 0) return;

    const source = outputCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(outputCtx.destination);

    const startTime = Math.max(outputCtx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;

    activeSourcesRef.current.add(source);
    setIsModelSpeaking(true);

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setIsModelSpeaking(false);
      }
    };
  }, []);

  const appendOrUpdateStreamingTranscript = useCallback(
    (role: 'user' | 'assistant', chunkText: string, finished?: boolean) => {
      if (!chunkText) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === role && last.streaming) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            text: last.text + chunkText,
            streaming: !finished,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role,
            text: chunkText,
            streaming: !finished,
          },
        ];
      });
    },
    []
  );

  const finalizeStreamingRole = useCallback((role?: 'user' | 'assistant') => {
    setMessages((prev) =>
      prev.map((m) =>
        m.streaming && (!role || m.role === role) ? { ...m, streaming: false } : m
      )
    );
  }, []);

  const startLiveSession = useCallback(async () => {
    if (liveStatus === 'connecting' || liveStatus === 'connected') return;

    setErrorMsg(null);
    setIsOpen(true);
    setLiveStatus('connecting');
    setIsMuted(false);
    isMutedRef.current = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser. You can still type below.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/live-assistant`);
      wsRef.current = ws;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      const silentGain = inputCtx.createGain();
      silentGain.gain.value = 0;

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(inputCtx.destination);

      processorRef.current = processor;
      silentGainRef.current = silentGain;

      processor.onaudioprocess = (event) => {
        if (!liveReadyRef.current || isMutedRef.current) {
          setMicLevel(0);
          return;
        }
        const socket = wsRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        const channelData = event.inputBuffer.getChannelData(0);
        let sumSq = 0;
        for (let i = 0; i < channelData.length; i++) {
          sumSq += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sumSq / channelData.length);
        setMicLevel(Math.min(1, rms * 6));

        const base64Audio = float32ToPcm16Base64(channelData);
        socket.send(JSON.stringify({ type: 'audio', audio: base64Audio }));
      };

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'init',
            token: getMemoryAuthToken(),
            pageContext: getCurrentPageContext() || (user ? `${user.role} Dashboard` : 'Sign-In Page'),
            recentError:
              recentError && Date.now() - recentError.timestamp < 120000
                ? recentError
                : null,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ready') {
            liveReadyRef.current = true;
            setLiveStatus('connected');
          } else if (data.type === 'audio' && data.audio) {
            playAudioChunk(data.audio);
          } else if (data.type === 'navigate' && data.action) {
            const navAction = data.action as AssistantNavAction;
            emitNavigateAction(navAction);
            setMessages((prev) => [
              ...prev,
              {
                id: `nav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                role: 'assistant',
                text: navAction.searchQuery
                  ? `Navigated to ${navAction.tabLabel} and filtered for "${navAction.searchQuery}".`
                  : `Opened ${navAction.tabLabel}.`,
                action: navAction,
              },
            ]);
          } else if (data.type === 'inputTranscript' && data.text) {
            finalizeStreamingRole('assistant');
            appendOrUpdateStreamingTranscript('user', data.text, data.finished);
          } else if (data.type === 'outputTranscript' && data.text) {
            finalizeStreamingRole('user');
            appendOrUpdateStreamingTranscript('assistant', data.text, data.finished);
          } else if (data.type === 'interrupted') {
            stopQueuedOutputAudio();
            finalizeStreamingRole('assistant');
          } else if (data.type === 'turnComplete') {
            finalizeStreamingRole();
          } else if (data.type === 'error') {
            setErrorMsg(data.message || 'Voice assistant connection error.');
            stopLiveSession('error');
          } else if (data.type === 'closed') {
            stopLiveSession('idle');
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        setErrorMsg('Unable to connect to the live voice assistant. Please try again.');
        stopLiveSession('error');
      };

      ws.onclose = () => {
        if (liveReadyRef.current) {
          stopLiveSession('idle');
        }
      };
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Microphone permission is required for live voice conversation.'
      );
      stopLiveSession('error');
    }
  }, [
    appendOrUpdateStreamingTranscript,
    finalizeStreamingRole,
    liveStatus,
    playAudioChunk,
    stopLiveSession,
    stopQueuedOutputAudio,
    user,
  ]);

  const sendQuestion = useCallback(
    async (question: string, errorOverride?: EntryErrorEvent | null) => {
      const trimmed = question.trim();
      if (!trimmed || sendingText) return;

      setErrorMsg(null);
      setTextInput('');
      finalizeStreamingRole();

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);

      if (
        !errorOverride &&
        liveStatus === 'connected' &&
        liveReadyRef.current &&
        wsRef.current?.readyState === WebSocket.OPEN
      ) {
        wsRef.current.send(JSON.stringify({ type: 'text', text: trimmed }));
        return;
      }

      const activeError =
        errorOverride !== undefined
          ? errorOverride
          : recentError && Date.now() - recentError.timestamp < 120000
            ? recentError
            : null;

      setSendingText(true);
      try {
        const res = await apiFetch<{
          reply: string;
          navigationAction?: AssistantNavAction | null;
        }>('/api/assistant/ask', {
          method: 'POST',
          body: JSON.stringify({
            message: trimmed,
            history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
            pageContext: getCurrentPageContext() || (user ? `${user.role} Dashboard` : 'Sign-In Page'),
            recentError: activeError,
          }),
        });

        if (res.navigationAction) {
          emitNavigateAction(res.navigationAction);
        }

        if (errorOverride) {
          setRecentError(null);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: res.reply,
            action: res.navigationAction || null,
          },
        ]);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Assistant could not respond right now.');
      } finally {
        setSendingText(false);
      }
    },
    [finalizeStreamingRole, liveStatus, messages, recentError, sendingText, user]
  );

  useEffect(() => {
    return subscribeAskAiForError((err) => {
      setIsOpen(true);
      setRecentError(err);
      void sendQuestion(
        `I got an error while entering information: "${err.title} — ${err.message}". Please explain why this happened and how I can fix it.`,
        err
      );
    });
  }, [sendQuestion]);

  const quickPrompts = useMemo(() => {
    if (!user) {
      return [
        'How do I sign in to my portal?',
        'What if I get an invalid credentials error?',
        'Where do parents get login IDs?',
      ];
    }
    if (user.role === 'ADMIN') {
      return [
        'Open Student Enrollment',
        'Go to Classes & Teachers',
        'Show teachers in Faculty & Accounts',
      ];
    }
    if (user.role === 'TEACHER') {
      return [
        'Open my Class Students roster',
        'Take me to Marks & CSV upload',
        'Open Attendance page',
      ];
    }
    return [
      'Take me to Performance & Marks',
      'Open Fee Status & Receipts',
      'Open Study Notes Library',
    ];
  }, [user]);

  const statusText = useMemo(() => {
    if (liveStatus === 'connecting') return 'Connecting voice...';
    if (liveStatus === 'connected') {
      if (isModelSpeaking) return 'Speaking...';
      if (isMuted) return 'Mic muted';
      return 'Listening live';
    }
    if (liveStatus === 'error') return 'Connection issue';
    return 'Ready to help';
  }, [isModelSpeaking, isMuted, liveStatus]);

  const bottomOffsetClass = user ? 'bottom-[4.5rem] lg:bottom-6' : 'bottom-5';
  const hasActiveEntryError = Boolean(
    recentError && Date.now() - recentError.timestamp < 120000
  );

  return (
    <div
      ref={widgetRootRef}
      className={`fixed ${bottomOffsetClass} right-4 lg:right-6 z-50 flex flex-col items-end`}
    >
      {isOpen && (
        <section
          aria-label="AI Voice Assistant"
          className="mb-3 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[75vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-[#1E3A8A] text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold truncate">
                  MVA Voice Assistant
                </h2>
                <div className="flex items-center gap-1.5 text-[11px] text-blue-100">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      liveStatus === 'connected'
                        ? isModelSpeaking
                          ? 'bg-amber-300 animate-pulse'
                          : 'bg-emerald-400 animate-pulse'
                        : liveStatus === 'connecting'
                          ? 'bg-amber-300 animate-ping'
                          : liveStatus === 'error'
                            ? 'bg-red-400'
                            : 'bg-blue-300'
                    }`}
                  />
                  <span className="truncate">
                    {statusText} · {schoolSettings?.schoolName || 'Macro Vision Academy'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {liveStatus === 'connected' && (
                <button
                  type="button"
                  onClick={() => setSpeakerMuted((v) => !v)}
                  title={speakerMuted ? 'Unmute assistant voice' : 'Mute assistant voice'}
                  aria-label={speakerMuted ? 'Unmute assistant voice' : 'Mute assistant voice'}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                >
                  {speakerMuted ? (
                    <VolumeX className="w-4 h-4 text-red-200" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Minimize assistant"
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Voice Visualizer Bar */}
          {liveStatus === 'connected' && (
            <div className="px-4 py-2.5 bg-blue-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                <div className="flex items-end gap-0.5 h-4">
                  {[0.45, 0.85, 1, 0.7, 0.5].map((scale, idx) => {
                    const activeBar = isModelSpeaking
                      ? 4 + Math.round(scale * 11)
                      : isMuted
                        ? 3
                        : Math.max(3, Math.round(3 + micLevel * scale * 13));
                    return (
                      <span
                        key={idx}
                        style={{ height: `${activeBar}px` }}
                        className={`w-1 rounded-full transition-all duration-100 ${
                          isModelSpeaking
                            ? 'bg-amber-500'
                            : isMuted
                              ? 'bg-slate-400'
                              : 'bg-[#1E3A8A] dark:bg-blue-400'
                        }`}
                      />
                    );
                  })}
                </div>
                <span>
                  {isModelSpeaking
                    ? 'Assistant speaking...'
                    : isMuted
                      ? 'Microphone paused'
                      : 'Speak naturally to ask anything'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsMuted((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                    isMuted
                      ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  type="button"
                  onClick={() => stopLiveSession('idle')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  <PhoneOff className="w-3 h-3" />
                  End
                </button>
              </div>
            </div>
          )}

          {/* Active Entry Error Banner */}
          {recentError && (
            <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 truncate">
                    {recentError.title}
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 line-clamp-2">
                    {recentError.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    void sendQuestion(
                      `Help me solve this entry error: "${recentError.title} — ${recentError.message}".`,
                      recentError
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold whitespace-nowrap"
                >
                  Solve Error
                </button>
                <button
                  type="button"
                  onClick={() => setRecentError(null)}
                  aria-label="Dismiss error banner"
                  className="p-1 text-amber-700 dark:text-amber-300 hover:opacity-75"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Conversation Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[210px] max-h-[340px] bg-slate-50/70 dark:bg-slate-950/40">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Hi{user?.fullName ? ` ${user.fullName.split(' ')[0]}` : ''}! Tell me any page
                  or record to open (e.g. <em className="text-slate-900 dark:text-white">&ldquo;Open Student Enrollment and search Rajveer&rdquo;</em>), or ask me to fix any form error.
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-0.5 flex items-center gap-1">
                    <Compass className="w-3 h-3" /> Quick navigation &amp; help
                  </div>
                  {quickPrompts.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void sendQuestion(q)}
                      className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#1E3A8A] dark:hover:border-blue-500 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#1E3A8A] text-white rounded-br-sm'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                    }`}
                  >
                    <div>{msg.text}</div>
                    {msg.action && (
                      <button
                        type="button"
                        onClick={() => emitNavigateAction(msg.action!)}
                        className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[#1E3A8A] dark:text-blue-300 text-[11px] font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        Opened: {msg.action.tabLabel}
                        {msg.action.searchQuery ? ` · "${msg.action.searchQuery}"` : ''}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {sendingText && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-2.5 text-xs text-red-700 dark:text-red-300">
                {errorMsg}
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Action Footer: Voice Start + Text Input */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
            {liveStatus !== 'connected' && (
              <button
                type="button"
                disabled={liveStatus === 'connecting'}
                onClick={() => void startLiveSession()}
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                {liveStatus === 'connecting' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Connecting Live Voice...
                  </>
                ) : (
                  <>
                    <PhoneCall className="w-3.5 h-3.5" />
                    Start Live Voice Help
                  </>
                )}
              </button>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendQuestion(textInput);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Ask a query, jump to a page, or fix an error..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              />
              <button
                type="submit"
                disabled={!textInput.trim() || sendingText}
                aria-label="Send message"
                className="p-2 rounded-xl bg-slate-900 dark:bg-blue-600 hover:opacity-90 disabled:opacity-40 text-white transition-opacity shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Floating Launcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
        className={`relative group inline-flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border transition-all ${
          liveStatus === 'connected'
            ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500 text-white'
            : hasActiveEntryError
              ? 'bg-amber-600 hover:bg-amber-700 border-amber-500 text-white'
              : 'bg-[#1E3A8A] hover:bg-blue-900 border-blue-800 text-white'
        }`}
      >
        {liveStatus === 'connected' && (
          <span className="absolute -inset-0.5 rounded-2xl border-2 border-emerald-400 animate-ping opacity-40 pointer-events-none" />
        )}
        {hasActiveEntryError ? (
          <AlertTriangle className="w-4 h-4 shrink-0" />
        ) : (
          <Mic className="w-4 h-4 shrink-0" />
        )}
        <span className="text-xs font-semibold tracking-tight whitespace-nowrap">
          {liveStatus === 'connected'
            ? 'Voice Active'
            : hasActiveEntryError
              ? 'Fix Entry Error'
              : 'AI Assistant'}
        </span>
      </button>
    </div>
  );
};
