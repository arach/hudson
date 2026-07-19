import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TraceProvider, useTrace } from '../src/apps/trace-viewer/TraceProvider';
import { WorkspaceHostRoutesProvider } from '../src/workspace/hostRoutes';
import { useServiceRegistry } from '../src/workspace/services/useServiceRegistry';

const POLL_MS = 30_000;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function resolveRequest(request: Deferred<Response>, body: unknown) {
  await act(async () => {
    request.resolve(jsonResponse(body));
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  setVisibility('hidden');
});

afterEach(() => {
  cleanup();
  setVisibility('visible');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('service registry polling', () => {
  it('polls only while visible, stays single-flight, and aborts stale work', async () => {
    const requests: Array<{ deferred: Deferred<Response>; signal?: AbortSignal | null }> = [];
    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      const next = deferred<Response>();
      requests.push({ deferred: next, signal: init?.signal });
      return next.promise;
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, unmount } = renderHook(() =>
      useServiceRegistry({ services: '/api/services' }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    act(() => setVisibility('visible'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(POLL_MS * 2));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await resolveRequest(requests[0].deferred, []);
    act(() => vi.advanceTimersByTime(POLL_MS));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const recordsBeforeHide = result.current.records;
    act(() => setVisibility('hidden'));
    expect(requests[1].signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    await resolveRequest(requests[1].deferred, []);
    expect(result.current.records).toBe(recordsBeforeHide);
    act(() => vi.advanceTimersByTime(POLL_MS * 2));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    act(() => setVisibility('visible'));
    expect(fetchMock).toHaveBeenCalledTimes(3);

    unmount();
    expect(requests[2].signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

function TraceWrapper({ children }: { children: ReactNode }) {
  return (
    <WorkspaceHostRoutesProvider routes={{ traces: '/api/traces' }}>
      <TraceProvider>{children}</TraceProvider>
    </WorkspaceHostRoutesProvider>
  );
}

describe('trace viewer polling', () => {
  it('polls only while visible, stays single-flight, and ignores hidden completions', async () => {
    const requests: Array<{ deferred: Deferred<Response>; signal?: AbortSignal | null }> = [];
    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      const next = deferred<Response>();
      requests.push({ deferred: next, signal: init?.signal });
      return next.promise;
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, unmount } = renderHook(() => useTrace(), { wrapper: TraceWrapper });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    act(() => setVisibility('visible'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(POLL_MS * 2));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstTrace = { id: 'trace-1', startedAt: 1, status: 'complete' };
    await resolveRequest(requests[0].deferred, { traces: [firstTrace] });
    expect(result.current.traces).toEqual([firstTrace]);

    act(() => vi.advanceTimersByTime(POLL_MS));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    act(() => setVisibility('hidden'));
    expect(requests[1].signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    const staleTrace = { id: 'trace-stale', startedAt: 2, status: 'running' };
    await resolveRequest(requests[1].deferred, { traces: [staleTrace] });
    expect(result.current.traces).toEqual([firstTrace]);
    act(() => vi.advanceTimersByTime(POLL_MS * 2));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    act(() => setVisibility('visible'));
    expect(fetchMock).toHaveBeenCalledTimes(3);

    unmount();
    expect(requests[2].signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
