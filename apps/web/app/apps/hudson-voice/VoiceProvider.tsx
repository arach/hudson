'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { connectGPTLiveWebRTC } from '@hudsonkit/ai/conversation';
import { VoiceController } from './VoiceController';
import type { VoiceContextValue } from './voice-types';

const Context = createContext<VoiceContextValue | null>(null);
export function VoiceProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new VoiceController(() => ({
    media: navigator.mediaDevices,
    fetch: window.fetch.bind(window),
    createPeer: () => new RTCPeerConnection(),
    createAudio: () => new Audio(),
    createStream: track => new MediaStream([track]),
    connect: connectGPTLiveWebRTC,
  })));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    void controller.refreshAvailability();
    const refresh = () => { void controller.listMicrophones().catch(() => {}); };
    const stop = () => { void controller.disconnect(); };
    refresh();
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    window.addEventListener('pagehide', stop);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', refresh);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [controller]);
  const value: VoiceContextValue = { ...state,
    connect: controller.connect, disconnect: controller.disconnect,
    refreshAvailability: controller.refreshAvailability, refreshMicrophones: controller.refreshMicrophones,
    selectMicrophone: controller.selectMicrophone, toggleMicrophone: controller.toggleMicrophone,
    interrupt: controller.interrupt, resumePlayback: controller.resumePlayback, clearTranscript: controller.clearTranscript,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useVoice(): VoiceContextValue {
  const value = useContext(Context);
  if (!value) throw new Error('Voice requires VoiceProvider.');
  return value;
}
