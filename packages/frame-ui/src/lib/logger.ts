/**
 * Event-based logging bus.
 * Components emit via logEvent(), any component can listen via CustomEvent on window.
 */

type LogPayload = Record<string, unknown>;

export const FRAME_LOG_EVENT = 'frame:log';

export interface FrameLogEntry {
  id: string;
  label: string;
  tag: string;
  timestamp: string;
  payload: LogPayload;
}

const readDebugFlag = (key: string) => {
  if (typeof window === 'undefined') return false;
  const globalFlag = (window as unknown as Record<string, unknown>)[key];
  if (typeof globalFlag === 'boolean') return globalFlag;
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
};

export const logEvent = (label: string, payload: LogPayload, tag = 'LOG') => {
  if (!readDebugFlag('FRAME_DEBUG')) return;
  const timestamp = new Date().toISOString();
  if (typeof window !== 'undefined') {
    const detail: FrameLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label, tag, timestamp, payload
    };
    window.dispatchEvent(new CustomEvent(FRAME_LOG_EVENT, { detail }));
  }
};
