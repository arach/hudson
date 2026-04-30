'use client';

import { useMemo, createElement } from 'react';
import type { CommandOption, StatusColor } from 'hudsonkit';
import { useApiInspector } from './ApiInspectorProvider';

// ---------------------------------------------------------------------------
// useCommands
// ---------------------------------------------------------------------------
export function useApiInspectorCommands(): CommandOption[] {
  const {
    sendRequest, clearResponse, clearHistory,
    setRequestTab, setResponseTab, setMethod,
  } = useApiInspector();

  return useMemo<CommandOption[]>(() => [
    { id: 'api-inspector:send', label: 'Send Request', action: sendRequest, shortcut: 'Cmd+Enter' },
    { id: 'api-inspector:clear-response', label: 'Clear Response', action: clearResponse },
    { id: 'api-inspector:clear-history', label: 'Clear History', action: clearHistory },
    { id: 'api-inspector:tab-params', label: 'Tab: Params', action: () => setRequestTab('params') },
    { id: 'api-inspector:tab-headers', label: 'Tab: Headers', action: () => setRequestTab('headers') },
    { id: 'api-inspector:tab-body', label: 'Tab: Body', action: () => setRequestTab('body') },
    { id: 'api-inspector:response-body', label: 'Response: Body', action: () => setResponseTab('body') },
    { id: 'api-inspector:response-headers', label: 'Response: Headers', action: () => setResponseTab('headers') },
    { id: 'api-inspector:method-get', label: 'Method: GET', action: () => setMethod('GET') },
    { id: 'api-inspector:method-post', label: 'Method: POST', action: () => setMethod('POST') },
    { id: 'api-inspector:method-put', label: 'Method: PUT', action: () => setMethod('PUT') },
    { id: 'api-inspector:method-patch', label: 'Method: PATCH', action: () => setMethod('PATCH') },
    { id: 'api-inspector:method-delete', label: 'Method: DELETE', action: () => setMethod('DELETE') },
  ], [sendRequest, clearResponse, clearHistory, setRequestTab, setResponseTab, setMethod]);
}

// ---------------------------------------------------------------------------
// useStatus
// ---------------------------------------------------------------------------
export function useApiInspectorStatus(): { label: string; color: StatusColor } {
  const { loading, response, responseError } = useApiInspector();
  if (loading) return { label: 'SENDING', color: 'amber' };
  if (responseError) return { label: 'ERROR', color: 'red' };
  if (response) {
    if (response.status >= 200 && response.status < 300) return { label: `${response.status}`, color: 'emerald' };
    if (response.status >= 400) return { label: `${response.status}`, color: 'red' };
    return { label: `${response.status}`, color: 'amber' };
  }
  return { label: 'READY', color: 'neutral' };
}

// ---------------------------------------------------------------------------
// useNavCenter
// ---------------------------------------------------------------------------
export function useApiInspectorNavCenter() {
  const { request } = useApiInspector();
  return createElement('span', {
    className: 'text-[10px] font-mono text-neutral-500 uppercase tracking-wider',
  }, request.method);
}

// ---------------------------------------------------------------------------
// useNavActions
// ---------------------------------------------------------------------------
export function useApiInspectorNavActions() {
  const { response } = useApiInspector();
  if (!response) return null;
  return createElement('span', {
    className: 'text-[11px] font-mono text-neutral-400 flex items-center gap-2',
  },
    createElement('span', { className: `font-bold ${response.status < 400 ? 'text-emerald-400' : 'text-red-400'}` }, `${response.status}`),
    createElement('span', { className: 'text-neutral-600' }, '|'),
    createElement('span', {}, `${response.timing.durationMs}ms`),
  );
}

// ---------------------------------------------------------------------------
// useLayoutMode
// ---------------------------------------------------------------------------
export function useApiInspectorLayoutMode(): 'canvas' | 'panel' {
  return 'panel';
}
