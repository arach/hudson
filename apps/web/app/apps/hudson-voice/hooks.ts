'use client';

import { createElement } from 'react';
import type { CommandOption, StatusState } from 'hudsonkit';
import { AudioLines, Mic, Play, Power, RotateCcw, Trash2, VolumeX } from 'hudsonkit/icons';
import { useVoice } from './VoiceProvider';

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function useVoiceCommands(): CommandOption[] {
  const voice = useVoice();
  const commands: CommandOption[] = [];

  const canConnect =
    (voice.phase === 'idle' || voice.phase === 'error') &&
    voice.availability.ready &&
    !voice.loading &&
    !voice.selectingMicrophone;
  if (canConnect) {
    commands.push({
      id: 'voice:connect',
      label: 'Voice · Connect microphone',
      icon: createElement(AudioLines, { size: 14 }),
      action: () => { void voice.connect(); },
    });
  }
  if (voice.phase === 'connecting' || voice.phase === 'connected') {
    commands.push({
      id: 'voice:end',
      label: 'Voice · End session',
      icon: createElement(Power, { size: 14 }),
      action: () => { void voice.disconnect(); },
    });
  }
  if (voice.phase === 'connected') {
    commands.push({
      id: 'voice:toggle-mic',
      label: voice.microphoneMuted ? 'Voice · Unmute microphone' : 'Voice · Mute microphone',
      icon: createElement(Mic, { size: 14 }),
      action: () => voice.toggleMicrophone(),
    });
    if (voice.playbackMuted || voice.playbackBlocked) {
      commands.push({
        id: 'voice:resume-playback',
        label: 'Voice · Resume playback',
        icon: createElement(Play, { size: 14 }),
        action: () => { void voice.resumePlayback(); },
      });
    } else {
      commands.push({
        id: 'voice:interrupt',
        label: 'Voice · Interrupt playback',
        icon: createElement(VolumeX, { size: 14 }),
        action: () => voice.interrupt(),
      });
    }
  }
  commands.push({
    id: 'voice:refresh-microphones',
    label: 'Voice · Refresh microphones',
    icon: createElement(RotateCcw, { size: 14 }),
    action: () => { void voice.refreshMicrophones(); },
  });
  const sessionBusy =
    voice.phase === 'connecting' || voice.phase === 'connected' || voice.phase === 'disconnecting';
  if (voice.transcript.length > 0 && !sessionBusy) {
    commands.push({
      id: 'voice:clear-transcript',
      label: 'Voice · Clear transcript',
      icon: createElement(Trash2, { size: 14 }),
      action: () => voice.clearTranscript(),
    });
  }
  return commands;
}

export function useVoiceStatus(): StatusState {
  const voice = useVoice();
  switch (voice.phase) {
    case 'connecting':
      return { label: 'connecting', color: 'amber' };
    case 'connected':
      return { label: `live · ${formatClock(voice.elapsedSeconds)}`, color: 'emerald' };
    case 'disconnecting':
      return { label: 'ending', color: 'amber' };
    case 'error':
      return { label: 'session error', color: 'red', title: voice.message || undefined };
    default:
      return voice.availability.ready
        ? { label: 'ready', color: 'neutral' }
        : { label: 'setup needed', color: 'amber', title: voice.availability.message || undefined };
  }
}

export function useVoiceLayoutMode(): 'focus' {
  return 'focus';
}
