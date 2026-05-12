'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Sparkles, Loader2, Bot, ImageIcon, X, Camera, Mic, Square, AlertTriangle } from 'lucide-react';
import Markdown from 'react-markdown';
import { useHudsonAI, usePersistentState, useDebouncedPersistentState, probeVoxAvailability } from 'hudsonkit';
import type { UIMessage } from 'ai';
import type { HudsonWorkspace } from 'hudsonkit';
import { createVoxdClient, VoxDError } from '@voxd/client';
import type { VoiceSettings } from '../apps/hudson-docs/types';
import type { HudsonAIToolContext, HudsonAIWorkspaceCatalogEntry } from './HudsonAIRuntimeContext';
import {
  DEFAULT_HUDSON_AI_DEV_MODEL_PRESET,
  DEFAULT_HUDSON_AI_DEV_MODEL_PRESET_ID,
  HUDSON_AI_DEV_MODEL_PRESETS,
} from '../lib/ai-models';
import { useDataBus } from './DataBusContext';
import { createHudsonSpokenReply, getHudsonMessageDisplayText } from './voiceReply';
import {
  HUDSON_VOX_CLIENT_ID,
  HUDSON_VOX_INTEGRATION_API_PATH,
  createHudsonVoxLaunchUrl,
} from '../lib/voxIntegration';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileAttachment {
  id: string;
  name: string;
  mediaType: string;
  /** Data URL for sending to the AI model */
  dataUrl: string;
  /** Blob URL for efficient preview rendering (falls back to dataUrl) */
  previewUrl: string;
}

type VoiceStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'ready'
  | 'synthesizing'
  | 'speaking'
  | 'unavailable'
  | 'error';

const VOX_INSTALL_URL = 'https://github.com/arach/vox/releases/latest/download/Vox.dmg';
const DEFAULT_VOICE_MIME_TYPE = 'audio/ogg;codecs=opus';
const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  autoSend: true,
  speakReplies: false,
  replyProvider: 'vox',
  replyModel: 'avspeech:system',
  replyVoice: '',
  replyRate: 1,
  spokenReplyStyle: 'adaptive',
  spokenReplyLongResponse: 'invite',
  spokenReplyCodeResponse: 'summary',
  spokenReplyMaxChars: 720,
};
const WORKSPACE_AI_CHAT_ID = 'hudson-workspace-ai';
const WORKSPACE_AI_MESSAGES_STORAGE_KEY = 'hudson.workspace-ai.chat.messages';
const WORKSPACE_AI_SESSION_STORAGE_KEY = 'hudson.workspace-ai.chat.session-id';

export interface WorkspaceAIComposerRequest {
  id: number;
  text: string;
  submit?: boolean;
}

interface WorkspaceAIProps {
  workspace: HudsonWorkspace;
  /** Callback to execute tool calls against app state */
  onToolCall: (name: string, args: Record<string, unknown>) => void | Promise<void>;
  voiceSettings: VoiceSettings;
  voiceTriggerNonce: number;
  toolContext?: HudsonAIToolContext | Record<string, unknown>;
  provider?: string;
  model?: string;
  composerRequest?: WorkspaceAIComposerRequest | null;
  onComposerRequestConsumed?: (requestId: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/ogg;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/webm;codecs=opus',
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type));
}

function stopStreamTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}

function inferVoiceFormat(mimeType: string): 'wav' | 'aac' | 'opus' {
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('aac') || mimeType.includes('mp4')) return 'aac';
  return 'opus';
}

function resolveRecordedMimeType(chunks: Blob[], mimeType: string): string {
  if (mimeType) return mimeType;
  const typedChunk = chunks.find(chunk => chunk.type);
  return typedChunk?.type || DEFAULT_VOICE_MIME_TYPE;
}

function pickReplySpeechFormat(): 'aac' | 'wav' {
  if (typeof document === 'undefined') return 'wav';
  const audio = document.createElement('audio');
  return audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? 'aac' : 'wav';
}

function normalizeVoiceError(error: unknown): { status: 'unavailable' | 'error'; message: string } {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'this origin';

  if (error instanceof VoxDError) {
    if (error.code === 'network_error') {
      return {
        status: 'unavailable',
        message: 'Vox Companion is not reachable on 127.0.0.1:43115. Install Vox.app, or launch it if it is already installed.',
      };
    }
    if (error.code === 'http_error') {
      if (error.message.includes('Origin not allowed') || error.message.includes('403')) {
        return {
          status: 'error',
          message: `Vox rejected Hudson's request. Allowlist ${origin} in Vox settings and try again.`,
        };
      }
      return {
        status: 'error',
        message: 'Vox returned an error while transcribing. Check Vox and try again.',
      };
    }
    return { status: 'error', message: error.message };
  }

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return { status: 'error', message: 'Microphone access was denied.' };
    }
    if (error.name === 'NotFoundError') {
      return { status: 'error', message: 'No microphone is available.' };
    }
  }

  if (error instanceof Error) {
    return { status: 'error', message: error.message };
  }

  return { status: 'error', message: 'Voice capture failed.' };
}

function getVoiceBadge(status: VoiceStatus): { label: string; className: string } | null {
  switch (status) {
    case 'recording':
      return {
        label: 'listening',
        className: 'border-red-500/20 bg-red-500/10 text-red-300',
      };
    case 'transcribing':
      return {
        label: 'transcribing',
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      };
    case 'ready':
      return {
        label: 'draft ready',
        className: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
      };
    case 'synthesizing':
      return {
        label: 'voicing',
        className: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
      };
    case 'speaking':
      return {
        label: 'speaking',
        className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
      };
    case 'unavailable':
      return {
        label: 'voice offline',
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      };
    case 'error':
      return {
        label: 'voice error',
        className: 'border-red-500/20 bg-red-500/10 text-red-300',
      };
    default:
      return null;
  }
}

async function registerHudsonVoxIntegration() {
  if (typeof window === 'undefined') return false;

  const response = await fetch(HUDSON_VOX_INTEGRATION_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: window.location.origin }),
  });

  return response.ok;
}

/** Capture the visible workspace as a blob + data URL via html2canvas. */
async function captureWorkspace(): Promise<{ blobUrl: string; dataUrl: string } | null> {
  try {
    // Target the top-level app page — the outermost element with actual dimensions
    const target = document.getElementById('__next') ?? document.body;

    const mod = await import('html2canvas-pro');
    const html2canvas = mod.default ?? mod;

    const canvas = await (html2canvas as (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>)(target, {
      backgroundColor: '#0a0a0a',
      scale: 0.5,
      useCORS: true,
      logging: false,
      allowTaint: true,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size < 200) {
      console.warn('[WorkspaceAI] capture produced empty blob');
      return null;
    }

    const blobUrl = URL.createObjectURL(blob);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    console.log('[WorkspaceAI] captured', canvas.width, 'x', canvas.height, '→', Math.round(blob.size / 1024), 'KB');
    return { blobUrl, dataUrl };
  } catch (e) {
    console.error('[WorkspaceAI] screenshot failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceAI({
  workspace,
  onToolCall,
  voiceSettings,
  voiceTriggerNonce,
  toolContext,
  provider,
  model,
  composerRequest,
  onComposerRequestConsumed,
}: WorkspaceAIProps) {
  const isDevModelPickerVisible = process.env.NODE_ENV === 'development';
  const canUseDevModelPicker = isDevModelPickerVisible && !provider && !model;
  const resolvedVoiceSettings = voiceSettings ?? DEFAULT_VOICE_SETTINGS;
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Array<{ dataUrl: string; prompt: string }>>([]);
  const [scopeWorkspaceId, setScopeWorkspaceId] = useState(workspace.id);
  const [devModelPresetId, setDevModelPresetId] = usePersistentState(
    'hudson.workspace-ai.dev-model-preset',
    DEFAULT_HUDSON_AI_DEV_MODEL_PRESET_ID,
  );
  const [persistedMessages, setPersistedMessages] = useDebouncedPersistentState<UIMessage[]>(
    WORKSPACE_AI_MESSAGES_STORAGE_KEY,
    [],
    160,
  );
  const [persistedSessionId, setPersistedSessionId] = usePersistentState(
    WORKSPACE_AI_SESSION_STORAGE_KEY,
    '',
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioUrlRef = useRef<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastVoiceTriggerRef = useRef(voiceTriggerNonce);
  const lastComposerRequestRef = useRef<number | null>(null);
  const attachmentsRef = useRef<FileAttachment[]>(attachments);
  const inputValueRef = useRef(input);
  const voiceSettingsRef = useRef(resolvedVoiceSettings);
  const voiceDraftPendingRef = useRef(false);
  const replySpeechPendingRef = useRef(false);
  const speechRequestIdRef = useRef(0);
  const pendingWorkspaceLoadIdRef = useRef<string | null>(null);
  const { pipes, getPortCatalog } = useDataBus();

  attachmentsRef.current = attachments;
  inputValueRef.current = input;
  voiceSettingsRef.current = resolvedVoiceSettings;

  const voxClient = useMemo(() => createVoxdClient({ clientId: HUDSON_VOX_CLIENT_ID }), []);

  useEffect(() => {
    void registerHudsonVoxIntegration().catch(error => {
      console.warn('[WorkspaceAI] Vox integration registration failed:', error);
    });
  }, []);

  const baseContext = useMemo(() => ({
    apps: workspace.apps.map(c => ({
      id: c.app.id,
      name: c.app.name,
      ports: c.app.ports,
    })),
    pipes: pipes.filter(p => p.source?.appId).map(p => ({
      name: p.name,
      source: p.source,
      sink: p.sink,
    })),
    portCatalog: getPortCatalog(),
  }), [workspace, pipes, getPortCatalog]);
  const context = useMemo(
    () => ({ ...baseContext, ...(toolContext ?? {}) }),
    [baseContext, toolContext],
  );
  const workspaceCatalog = useMemo<HudsonAIWorkspaceCatalogEntry[]>(() => {
    const catalog = (toolContext as HudsonAIToolContext | undefined)?.workspaces;
    if (catalog && catalog.length > 0) return catalog;
    return [{
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      mode: workspace.mode,
      current: true,
      defaultFocusedAppId: workspace.defaultFocusedAppId,
      apps: workspace.apps.map(({ app, canvasMode }) => ({
        id: app.id,
        name: app.name,
        description: app.description,
        mode: app.mode,
        canvasMode: canvasMode ?? 'native',
        services: app.services ?? [],
      })),
    }];
  }, [toolContext, workspace]);
  const scopedWorkspace = useMemo(
    () => workspaceCatalog.find(candidate => candidate.id === scopeWorkspaceId)
      ?? workspaceCatalog.find(candidate => candidate.current)
      ?? workspaceCatalog[0]
      ?? null,
    [scopeWorkspaceId, workspaceCatalog],
  );
  const isLiveScope = (scopedWorkspace?.id ?? workspace.id) === workspace.id;
  const scopedContext = useMemo(() => {
    if (!scopedWorkspace || isLiveScope) {
      return {
        ...context,
        scope: {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          mode: 'live',
          activeWorkspaceId: workspace.id,
          activeWorkspaceName: workspace.name,
          note: 'Hudson AI is operating on the active workspace with live app commands and settings.',
        },
      };
    }

    const globalCommands = Array.isArray((context as { commands?: HudsonAIToolContext['commands'] }).commands)
      ? ((context as { commands?: HudsonAIToolContext['commands'] }).commands ?? []).filter(command => command.scope !== 'app')
      : [];

    return {
      ...context,
      workspace: {
        id: scopedWorkspace.id,
        name: scopedWorkspace.name,
        description: scopedWorkspace.description,
        mode: scopedWorkspace.mode,
        focusedAppId: scopedWorkspace.defaultFocusedAppId ?? '',
        visibleAppIds: [],
        disabledAppIds: [],
        availableWorkspaces: workspaceCatalog.map(candidate => ({
          id: candidate.id,
          name: candidate.name,
          current: candidate.id === scopedWorkspace.id,
        })),
      },
      apps: scopedWorkspace.apps.map(app => ({
        id: app.id,
        name: app.name,
        description: app.description,
        mode: app.mode,
        canvasMode: app.canvasMode,
        visible: false,
        disabled: false,
        focused: app.id === scopedWorkspace.defaultFocusedAppId,
        tools: [],
        status: null,
        activeToolHint: null,
        services: app.services,
      })),
      commands: globalCommands,
      intents: [],
      appSettings: [],
      pipes: [],
      portCatalog: [],
      scope: {
        workspaceId: scopedWorkspace.id,
        workspaceName: scopedWorkspace.name,
        mode: 'peek',
        activeWorkspaceId: workspace.id,
        activeWorkspaceName: workspace.name,
        note: 'Peek mode shows the workspace definition and shell-global tools. App commands, pipes, and app settings are only live in the active workspace.',
      },
    };
  }, [context, isLiveScope, scopedWorkspace, workspace.id, workspace.name, workspaceCatalog]);
  const devModelPreset = useMemo(
    () =>
      HUDSON_AI_DEV_MODEL_PRESETS.find(preset => preset.value === devModelPresetId)
      ?? DEFAULT_HUDSON_AI_DEV_MODEL_PRESET,
    [devModelPresetId],
  );
  const activeModelPreset = canUseDevModelPicker ? devModelPreset : DEFAULT_HUDSON_AI_DEV_MODEL_PRESET;
  const activeProvider = provider ?? activeModelPreset.provider;
  const activeModel = model ?? activeModelPreset.model;

  useEffect(() => {
    if (devModelPreset.value !== devModelPresetId) {
      setDevModelPresetId(devModelPreset.value);
    }
  }, [devModelPreset.value, devModelPresetId, setDevModelPresetId]);

  useEffect(() => {
    if (workspaceCatalog.some(candidate => candidate.id === scopeWorkspaceId)) return;
    setScopeWorkspaceId(workspace.id);
  }, [scopeWorkspaceId, setScopeWorkspaceId, workspace.id, workspaceCatalog]);

  const chat = useHudsonAI({
    toolset: 'workspace',
    chatId: WORKSPACE_AI_CHAT_ID,
    initialMessages: persistedMessages,
    context: scopedContext,
    provider: activeProvider,
    model: activeModel,
    sessionId: persistedSessionId || undefined,
    onSessionIdChange: setPersistedSessionId,
    onToolCall: async (name, args) => {
      if (name === 'change_workspace_scope') {
        const targetWorkspaceId = typeof args.workspaceId === 'string' ? args.workspaceId : workspace.id;
        if (workspaceCatalog.some(candidate => candidate.id === targetWorkspaceId)) {
          setScopeWorkspaceId(targetWorkspaceId);
        }
        return;
      }
      if (name === 'load_workspace') {
        const targetWorkspaceId = typeof args.workspaceId === 'string' ? args.workspaceId : '';
        if (targetWorkspaceId && workspaceCatalog.some(candidate => candidate.id === targetWorkspaceId)) {
          pendingWorkspaceLoadIdRef.current = targetWorkspaceId;
          setScopeWorkspaceId(targetWorkspaceId);
        }
        return;
      }
      console.log('[WorkspaceAI] tool call:', name, args);
      await onToolCall(name, args);
    },
    onFinish: async ({ message, isAbort, isDisconnect, isError }) => {
      const nextMessages = message.role === 'assistant'
        ? [...(chatMessagesRef.current.filter(entry => entry.id !== message.id)), message]
        : chatMessagesRef.current;
      chatMessagesRef.current = nextMessages;
      setPersistedMessages(nextMessages);

      const pendingWorkspaceLoadId = pendingWorkspaceLoadIdRef.current;
      pendingWorkspaceLoadIdRef.current = null;
      if (!isAbort && !isDisconnect && !isError && pendingWorkspaceLoadId && pendingWorkspaceLoadId !== workspace.id) {
        await onToolCall('load_workspace', { workspaceId: pendingWorkspaceLoadId });
        return;
      }

      const shouldSpeak = replySpeechPendingRef.current;
      replySpeechPendingRef.current = false;

      if (!shouldSpeak || isAbort || isDisconnect || isError || message.role !== 'assistant') {
        return;
      }

      const displayText = getHudsonMessageDisplayText(message);
      const spokenText = createHudsonSpokenReply(
        displayText,
        voiceSettingsRef.current,
      );

      if (!spokenText) return;

      const requestId = speechRequestIdRef.current + 1;
      speechRequestIdRef.current = requestId;
      setVoiceStatus('synthesizing');
      setVoiceError(null);

      try {
        const response = await fetch('/v1/audio/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: spokenText,
            provider: voiceSettingsRef.current.replyProvider,
            model: voiceSettingsRef.current.replyModel,
            voice: voiceSettingsRef.current.replyVoice || undefined,
            rate: voiceSettingsRef.current.replyRate,
            format: pickReplySpeechFormat(),
            metadata: {
              surface: 'hudson-ai',
              workspaceId: workspace.id,
              source: 'assistant-reply',
            },
          }),
        });

        const payload = await response.json() as {
          error?: string;
          mimeType?: string;
          audioBase64?: string;
          audio?: { base64?: string; mimeType?: string };
        };

        if (!response.ok) {
          throw new Error(payload.error || `Speech synthesis failed (${response.status}).`);
        }

        const audioBase64 = payload.audio?.base64 ?? payload.audioBase64;
        const mimeType = payload.audio?.mimeType ?? payload.mimeType ?? 'audio/wav';

        if (!audioBase64) {
          throw new Error('Speech synthesis returned no audio.');
        }

        if (speechRequestIdRef.current !== requestId) {
          return;
        }

        if (speechAudioRef.current) {
          speechAudioRef.current.pause();
          speechAudioRef.current = null;
        }
        if (speechAudioUrlRef.current) {
          URL.revokeObjectURL(speechAudioUrlRef.current);
          speechAudioUrlRef.current = null;
        }

        const binary = Uint8Array.from(atob(audioBase64), char => char.charCodeAt(0));
        const blob = new Blob([binary], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);

        speechAudioRef.current = audio;
        speechAudioUrlRef.current = objectUrl;
        setVoiceStatus('speaking');

        audio.onended = () => {
          if (speechAudioRef.current === audio) {
            speechAudioRef.current = null;
          }
          if (speechAudioUrlRef.current === objectUrl) {
            URL.revokeObjectURL(objectUrl);
            speechAudioUrlRef.current = null;
          }
          setVoiceStatus(current => (current === 'speaking' ? 'idle' : current));
        };

        audio.onerror = () => {
          if (speechAudioRef.current === audio) {
            speechAudioRef.current = null;
          }
          if (speechAudioUrlRef.current === objectUrl) {
            URL.revokeObjectURL(objectUrl);
            speechAudioUrlRef.current = null;
          }
          setVoiceStatus('error');
          setVoiceError('Reply audio could not be played in this browser.');
        };

        await audio.play();
      } catch (error) {
        if (speechRequestIdRef.current !== requestId) {
          return;
        }
        stopReplyAudio();
        setVoiceStatus('error');
        setVoiceError(error instanceof Error ? error.message : 'Reply speech failed.');
      }
    },
  });

  const chatStatusRef = useRef(chat.status);
  const sendMessageRef = useRef(chat.sendMessage);
  const chatMessagesRef = useRef(chat.messages ?? []);
  chatStatusRef.current = chat.status;
  sendMessageRef.current = chat.sendMessage;
  chatMessagesRef.current = chat.messages ?? [];

  const stopReplyAudio = useCallback(() => {
    speechRequestIdRef.current += 1;

    const audio = speechAudioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      speechAudioRef.current = null;
    }

    if (speechAudioUrlRef.current) {
      URL.revokeObjectURL(speechAudioUrlRef.current);
      speechAudioUrlRef.current = null;
    }
  }, []);

  const clearAttachments = useCallback(() => {
    attachmentsRef.current = [];
    setAttachments(prev => {
      for (const attachment of prev) {
        if (attachment.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }
      return [];
    });
  }, []);

  // ── Add attachment from file ────────────────────────────────────────
  const addFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const dataUrl = await fileToDataUrl(file);
    const previewUrl = URL.createObjectURL(file);
    setAttachments(prev => [...prev, {
      id: generateId(),
      name: file.name,
      mediaType: file.type,
      dataUrl,
      previewUrl,
    }]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const removed = prev.find(a => a.id === id);
      if (removed && removed.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter(a => a.id !== id);
    });
  }, []);

  // ── Workspace screenshot ────────────────────────────────────────────
  const handleSnapshot = useCallback(async () => {
    setSnapping(true);
    try {
      const result = await captureWorkspace();
      if (result) {
        setAttachments(prev => [...prev, {
          id: generateId(),
          name: `snap-${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }).replace('/', '')}-${new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(':', '')}.jpg`,
          mediaType: 'image/jpeg',
          dataUrl: result.dataUrl,
          previewUrl: result.blobUrl,
        }]);
      }
    } finally {
      setSnapping(false);
    }
  }, []);

  // ── Submit with attachments ─────────────────────────────────────────
  const submitPrompt = useCallback((
    promptText: string,
    options?: { source?: 'text' | 'voice' },
  ) => {
    const currentAttachments = attachmentsRef.current;
    const trimmed = promptText.trim();
    const hasFiles = currentAttachments.length > 0;

    if ((!trimmed && !hasFiles) || chatStatusRef.current === 'streaming') {
      return false;
    }

    stopReplyAudio();

    const files = currentAttachments.map(attachment => ({
      type: 'file' as const,
      mediaType: attachment.mediaType,
      url: attachment.dataUrl,
      filename: attachment.name,
    }));

    sendMessageRef.current(
      files.length > 0
        ? { text: trimmed || 'What do you see?', files }
        : { text: trimmed },
    );
    replySpeechPendingRef.current = options?.source === 'voice' && voiceSettingsRef.current.speakReplies;
    voiceDraftPendingRef.current = false;
    setInput('');
    clearAttachments();
    return true;
  }, [clearAttachments, stopReplyAudio]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const sent = submitPrompt(input, {
      source: voiceDraftPendingRef.current ? 'voice' : 'text',
    });
    if (sent) {
      setLastTranscript(null);
      setVoiceStatus(current => (current === 'ready' ? 'idle' : current));
    }
  }, [input, submitPrompt]);

  useEffect(() => {
    if (!composerRequest || composerRequest.id === lastComposerRequestRef.current) return;
    lastComposerRequestRef.current = composerRequest.id;

    const nextText = composerRequest.text.trim();
    if (!nextText) {
      onComposerRequestConsumed?.(composerRequest.id);
      return;
    }

    stopReplyAudio();
    setVoiceError(null);
    setLastTranscript(null);
    voiceDraftPendingRef.current = false;

    const sent = composerRequest.submit
      ? submitPrompt(nextText, { source: 'text' })
      : false;

    if (!sent) {
      setInput(nextText);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setVoiceStatus(current => (current === 'ready' ? 'idle' : current));
    }

    onComposerRequestConsumed?.(composerRequest.id);
  }, [composerRequest, onComposerRequestConsumed, stopReplyAudio, submitPrompt]);

  // ── Voice capture ───────────────────────────────────────────────────
  const finalizeVoiceCapture = useCallback(async (chunks: Blob[], mimeType: string) => {
    stopStreamTracks(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;

    if (chunks.length === 0) {
      setVoiceStatus('error');
      setVoiceError('No audio was captured.');
      return;
    }

    setVoiceStatus('transcribing');
    setVoiceError(null);

    try {
      const recordedMimeType = resolveRecordedMimeType(chunks, mimeType);
      const result = await voxClient.transcribe({
        audio: new Blob(chunks, { type: recordedMimeType }),
        format: inferVoiceFormat(recordedMimeType),
        language: 'en',
        metadata: {
          clientId: HUDSON_VOX_CLIENT_ID,
          surface: 'hudson-ai',
          workspaceId: workspace.id,
        },
      });

      const transcript = result.text.trim();
      if (!transcript) {
        throw new Error('Vox returned an empty transcript.');
      }

      const mergedPrompt = [inputValueRef.current.trim(), transcript].filter(Boolean).join(' ');
      setLastTranscript(transcript);
      voiceDraftPendingRef.current = true;

      const autoSent = voiceSettingsRef.current.autoSend && chatStatusRef.current !== 'streaming'
        ? submitPrompt(mergedPrompt, { source: 'voice' })
        : false;

      if (!autoSent) {
        setInput(mergedPrompt);
        requestAnimationFrame(() => inputRef.current?.focus());
        setVoiceStatus('ready');
        return;
      }

      setLastTranscript(null);
      setVoiceStatus('idle');
    } catch (error) {
      const normalized = normalizeVoiceError(error);
      setVoiceStatus(normalized.status);
      setVoiceError(normalized.message);
    }
  }, [submitPrompt, voxClient, workspace.id]);

  const startVoiceCapture = useCallback(async () => {
    if (voiceStatus === 'recording' || voiceStatus === 'transcribing') return;

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus('error');
      setVoiceError('This browser cannot capture microphone audio.');
      return;
    }

    setVoiceError(null);
    setLastTranscript(null);
    voiceDraftPendingRef.current = false;
    replySpeechPendingRef.current = false;
    stopReplyAudio();

    try {
      await registerHudsonVoxIntegration();
      const availability = await probeVoxAvailability(voxClient);
      if (availability === 'blocked-origin') {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'this origin';
        setVoiceStatus('error');
        setVoiceError(`Vox rejected this origin. HudsonKit registered ${origin}; open Vox settings if the bridge has not refreshed yet.`);
        return;
      }
      if (availability === 'warming') {
        setVoiceStatus('unavailable');
        setVoiceError('Vox is starting up — try again in a moment.');
        return;
      }
      if (availability === 'unreachable') {
        setVoiceStatus('unavailable');
        setVoiceError('Vox Companion is not reachable on 127.0.0.1:43115. Install Vox.app, or launch it if it is already installed.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopStreamTracks(streamRef.current);
        streamRef.current = null;
        recorderRef.current = null;
        chunksRef.current = [];
        setVoiceStatus('error');
        setVoiceError('Voice capture failed while recording.');
      };

      recorder.onstop = () => {
        const recordedChunks = [...chunksRef.current];
        chunksRef.current = [];
        void finalizeVoiceCapture(recordedChunks, resolveRecordedMimeType(recordedChunks, recorder.mimeType || mimeType || ''));
      };

      recorder.start();
      setVoiceStatus('recording');
    } catch (error) {
      const normalized = normalizeVoiceError(error);
      setVoiceStatus(normalized.status);
      setVoiceError(normalized.message);
    }
  }, [finalizeVoiceCapture, stopReplyAudio, voiceStatus, voxClient]);

  const stopVoiceCapture = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    setVoiceStatus('transcribing');
    recorder.stop();
  }, []);

  const handleLaunchVox = useCallback(() => {
    void registerHudsonVoxIntegration().catch(error => {
      console.warn('[WorkspaceAI] Vox integration registration failed:', error);
    });
    window.location.href = createHudsonVoxLaunchUrl(window.location.origin);
  }, []);

  const handleInstallVox = useCallback(() => {
    window.open(VOX_INSTALL_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const handleOpenVoxSettings = useCallback(() => {
    void registerHudsonVoxIntegration().catch(error => {
      console.warn('[WorkspaceAI] Vox integration registration failed:', error);
    });
    voxClient.openSettings();
  }, [voxClient]);

  // ── Drag & drop ─────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      await addFile(file);
    }
  }, [addFile]);

  // ── Paste ───────────────────────────────────────────────────────────
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await addFile(file);
        }
        return;
      }
    }
  }, [addFile]);

  // Generated images (from tool calls)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.dataUrl) {
        setGeneratedImages(prev => [...prev, { dataUrl: detail.dataUrl, prompt: detail.prompt }]);
      }
    };
    window.addEventListener('hudson:generated-image', handler);
    return () => window.removeEventListener('hudson:generated-image', handler);
  }, []);

  // Auto-scroll on new messages or generated images
  const messages = chat.messages;
  useEffect(() => {
    setPersistedMessages(messages);
  }, [messages, setPersistedMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, generatedImages.length]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clean up any live recorder state if the component unmounts.
  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }
    stopStreamTracks(streamRef.current);
    stopReplyAudio();
  }, [stopReplyAudio]);

  // Start capture when the shell triggers voice mode.
  useEffect(() => {
    if (voiceTriggerNonce === lastVoiceTriggerRef.current) return;
    lastVoiceTriggerRef.current = voiceTriggerNonce;
    void startVoiceCapture();
  }, [startVoiceCapture, voiceTriggerNonce]);

  const voiceBadge = getVoiceBadge(voiceStatus);
  const voiceErrorText = voiceError?.toLowerCase() ?? '';
  const showRetryVox = voiceErrorText.includes('starting up');
  const showInstallVox = voiceErrorText.includes('not reachable');
  const showLaunchVox = voiceErrorText.includes('not reachable');
  const showOpenVoxSettings = voiceErrorText.includes('allowlist') || voiceErrorText.includes('origin') || voiceErrorText.includes('registered');
  const isChatBusy = chat.status === 'submitted' || chat.status === 'streaming';
  const scopeLabel = scopedWorkspace?.name ?? workspace.name;

  return (
    <div
      className="flex flex-col h-full bg-neutral-950"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <Bot size={13} className={chat.status === 'submitted' || chat.status === 'streaming' ? 'text-cyan-400 animate-pulse' : 'text-cyan-600'} />
        <span className="text-[11px] font-mono text-zinc-500">Hudson AI</span>
        {(chat.status === 'submitted' || chat.status === 'streaming') && (
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        )}
        {voiceBadge && (
          <span className={`ml-2 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${voiceBadge.className}`}>
            {voiceBadge.label}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {workspaceCatalog.length > 1 && (
            <label className="flex items-center gap-1 rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-1">
              <span className="text-[8px] font-mono uppercase tracking-[0.16em] text-zinc-700">
                scope
              </span>
              <select
                aria-label="Hudson AI workspace scope"
                value={scopedWorkspace?.id ?? workspace.id}
                disabled={isChatBusy}
                onChange={event => setScopeWorkspaceId(event.target.value)}
                className="max-w-[180px] bg-transparent text-[10px] font-mono text-zinc-500 outline-none disabled:cursor-not-allowed disabled:text-zinc-700"
                title={scopeLabel}
              >
                {workspaceCatalog.map(candidate => (
                  <option key={candidate.id} value={candidate.id} className="bg-neutral-950 text-white">
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${
            isLiveScope
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
          }`}>
            {isLiveScope ? 'live' : 'peek'}
          </span>
          {!isLiveScope && scopedWorkspace && (
            <button
              type="button"
              onClick={() => void onToolCall('load_workspace', { workspaceId: scopedWorkspace.id })}
              disabled={isChatBusy}
              className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-cyan-300 transition-colors hover:border-cyan-400/30 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-zinc-700"
            >
              load
            </button>
          )}
          {canUseDevModelPicker && (
            <label className="flex items-center gap-1 rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-1">
              <span className="text-[8px] font-mono uppercase tracking-[0.16em] text-zinc-700">
                dev
              </span>
              <select
                aria-label="Hudson AI model preset"
                value={devModelPreset.value}
                disabled={isChatBusy}
                onChange={event => setDevModelPresetId(event.target.value)}
                className="max-w-[190px] bg-transparent text-[10px] font-mono text-zinc-500 outline-none disabled:cursor-not-allowed disabled:text-zinc-700"
                title={`${devModelPreset.provider}/${devModelPreset.model}`}
              >
                {HUDSON_AI_DEV_MODEL_PRESETS.map(preset => (
                  <option key={preset.value} value={preset.value} className="bg-neutral-950 text-white">
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="max-w-[90px] truncate text-[9px] font-mono uppercase text-zinc-700" title={activeProvider}>
            {activeProvider}
          </span>
          <span className="max-w-[160px] truncate text-[9px] font-mono text-zinc-800" title={activeModel}>
            {activeModel}
          </span>
          <span className="max-w-[120px] truncate text-[9px] font-mono text-zinc-700" title={scopeLabel}>
            {scopeLabel}
          </span>
        </div>
      </div>

      {voiceError && (
        <div className={`px-3 py-2 border-b ${voiceStatus === 'unavailable' ? 'border-amber-500/10 bg-amber-500/5' : 'border-red-500/10 bg-red-500/5'}`}>
          <div className="flex items-start gap-2">
            <Mic size={12} className={voiceStatus === 'unavailable' ? 'text-amber-400 mt-0.5' : 'text-red-400 mt-0.5'} />
            <div className="flex-1 min-w-0">
              <div className={`text-[10px] font-mono uppercase tracking-wider ${voiceStatus === 'unavailable' ? 'text-amber-300/80' : 'text-red-300/80'}`}>
                {voiceStatus === 'unavailable' ? 'Voice unavailable' : 'Voice error'}
              </div>
              <div className="text-[11px] leading-relaxed text-zinc-400">
                {voiceError}
              </div>
            </div>
            {(showRetryVox || showInstallVox || showLaunchVox || showOpenVoxSettings) && (
              <div className="flex items-center gap-2 shrink-0">
                {showRetryVox && (
                  <button
                    type="button"
                    onClick={() => void startVoiceCapture()}
                    className="rounded border border-white/10 px-2 py-1 text-[10px] font-mono text-white/60 hover:text-white hover:border-white/20 transition-colors"
                  >
                    Retry
                  </button>
                )}
                {showInstallVox && (
                  <button
                    type="button"
                    onClick={handleInstallVox}
                    className="rounded border border-white/10 px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
                  >
                    Install Vox
                  </button>
                )}
                {showLaunchVox && (
                  <button
                    type="button"
                    onClick={handleLaunchVox}
                    className="rounded border border-white/10 px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
                  >
                    Launch Vox
                  </button>
                )}
                {showOpenVoxSettings && (
                  <button
                    type="button"
                    onClick={handleOpenVoxSettings}
                    className="rounded border border-white/10 px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
                  >
                    Settings
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto frame-scrollbar px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="text-[11px] text-zinc-800 text-center mt-8">
            Ask me anything about the workspace. I can act live in the current workspace, peek into another workspace, or load that workspace when you want to switch over.
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const fileParts = (msg.parts ?? []).filter((p: Record<string, unknown>) => p.type === 'file');
          const display = getHudsonMessageDisplayText(msg);

          if (!display && fileParts.length === 0) return null;

          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                isUser
                  ? 'bg-cyan-500/10 text-zinc-300 border border-cyan-500/15'
                  : 'bg-white/[0.03] text-zinc-400 border border-white/[0.05]'
              }`}>
                {fileParts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {fileParts.map((part: Record<string, unknown>, j: number) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        key={j}
                        src={part.url as string}
                        alt={(part.filename as string) ?? 'attachment'}
                        className="max-w-[120px] max-h-[80px] rounded border border-white/[0.08] object-contain"
                      />
                    ))}
                  </div>
                )}
                {display && (isUser
                  ? <span>{display}</span>
                  : <div className="hudson-ai-md"><Markdown>{display}</Markdown></div>
                )}
              </div>
            </div>
          );
        })}

        {generatedImages.map((image, idx) => (
          <div key={`gen-${idx}`} className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 bg-white/[0.03] border border-white/[0.05]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.dataUrl}
                alt={image.prompt}
                className="max-w-full rounded border border-white/[0.08]"
              />
              <div className="text-[9px] text-zinc-700 mt-1.5 truncate font-mono">{image.prompt}</div>
            </div>
          </div>
        ))}

        {(chat.status === 'submitted' || chat.status === 'streaming') && (
          <div className="flex items-start gap-2.5 py-1">
            <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={10} className="text-cyan-400 animate-pulse" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-cyan-400/60 animate-[bounce_1.4s_ease-in-out_infinite]" />
                  <span className="w-1 h-1 rounded-full bg-cyan-400/40 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                  <span className="w-1 h-1 rounded-full bg-cyan-400/20 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
                </div>
                <span className="text-[10px] text-cyan-700 font-mono">
                  {chat.status === 'submitted' ? 'Thinking' : 'Writing'}
                </span>
              </div>
            </div>
          </div>
        )}

        {chat.error && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2 text-[11px] leading-relaxed text-red-200/80">
              <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-red-300/80">
                <AlertTriangle size={11} />
                Hudson AI error
              </div>
              {chat.error.message}
            </div>
          </div>
        )}
      </div>

      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <div className="px-3 py-2 border-t border-white/[0.04] flex items-center gap-2 overflow-x-auto">
          {attachments.map(attachment => (
            <div key={attachment.id} className="relative group shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.previewUrl}
                alt={attachment.name}
                className="h-12 rounded border border-white/[0.08] object-contain"
              />
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={8} className="text-zinc-400" />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-zinc-600 px-1 truncate rounded-b">
                {attachment.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-white/[0.06]">
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={handleSnapshot}
            disabled={snapping}
            className="p-2 rounded-lg text-zinc-700 hover:text-cyan-500 hover:bg-white/[0.04] disabled:opacity-30 transition-colors"
            title="Capture workspace screenshot"
          >
            {snapping ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-zinc-700 hover:text-cyan-500 hover:bg-white/[0.04] transition-colors"
            title="Attach image"
          >
            <ImageIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (voiceStatus === 'recording') {
                stopVoiceCapture();
              } else {
                void startVoiceCapture();
              }
            }}
            disabled={voiceStatus === 'transcribing'}
            className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${
              voiceStatus === 'recording'
                ? 'bg-red-500/15 text-red-300 hover:bg-red-500/20'
                : 'text-zinc-700 hover:text-cyan-500 hover:bg-white/[0.04]'
            }`}
            title={voiceStatus === 'recording' ? 'Stop recording' : 'Record voice prompt'}
          >
            {voiceStatus === 'transcribing'
              ? <Loader2 size={14} className="animate-spin" />
              : voiceStatus === 'recording'
                ? <Square size={12} />
                : <Mic size={14} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async e => {
              const files = Array.from(e.target.files ?? []);
              for (const file of files) {
                await addFile(file);
              }
              e.target.value = '';
            }}
          />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            onPaste={handlePaste}
            placeholder="Ask Hudson anything..."
            className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/30 transition-colors"
          />
          <button
            type="submit"
            disabled={(!input.trim() && attachments.length === 0) || chat.status === 'streaming'}
            className="px-3 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            {chat.status === 'streaming' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
        {voiceStatus === 'ready' && lastTranscript && !resolvedVoiceSettings.autoSend && (
          <div className="mt-2 text-[10px] font-mono text-cyan-500">
            Voice draft ready. Press Enter to send or keep editing. Last transcript: {lastTranscript}
          </div>
        )}
      </form>

      {/* Drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-cyan-950/40 border-2 border-dashed border-cyan-500/30 rounded-lg pointer-events-none">
          <div className="text-[13px] text-cyan-500 font-medium flex items-center gap-2">
            <ImageIcon size={16} />
            Drop to attach
          </div>
        </div>
      )}
    </div>
  );
}
