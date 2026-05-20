// ---------------------------------------------------------------------------
// useAppApiStatus (HUD-008)
//
// Thin React binding over AppApiClient.serviceStatus. Same-origin clients
// without `backend.healthCheck` always return 'online' + a no-op retry, so UI
// code can branch uniformly across local routes and sibling services.
// ---------------------------------------------------------------------------

import { useCallback, useSyncExternalStore } from 'react';
import type { AppApiClient, AppApiServiceStatus } from '../lib/api/createAppApiClient';

export interface UseAppApiStatusResult {
  serviceStatus: AppApiServiceStatus;
  retry: () => void;
}

export function useAppApiStatus(client: AppApiClient): UseAppApiStatusResult {
  const subscribe = useCallback(
    (listener: () => void) => client.serviceStatus.subscribe(listener),
    [client],
  );
  const getSnapshot = useCallback(
    () => client.serviceStatus.get(),
    [client],
  );
  // Same-origin clients are deterministic 'online' on the server.
  const getServerSnapshot = useCallback<() => AppApiServiceStatus>(
    () => client.serviceStatus.get(),
    [client],
  );
  const serviceStatus = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const retry = useCallback(() => client.retry(), [client]);
  return { serviceStatus, retry };
}
