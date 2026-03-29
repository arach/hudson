'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { usePlatform } from '@hudson/sdk';

export interface AgentInfo {
  name: string;
  project: string;
  cwd: string | null;
  pid: number | null;
  registered: boolean;
  messageCount: number;
  lastSeen: number;
}

export interface ChannelEntry {
  timestamp: number;
  agent: string;
  type: string;
  message: string;
  subtype?: string;
}

interface OpenScoutState {
  agents: AgentInfo[];
  channel: ChannelEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  selectedAgent: string | null;
  setSelectedAgent: (name: string | null) => void;
}

const OpenScoutContext = createContext<OpenScoutState | null>(null);

export function useOpenScout() {
  const ctx = useContext(OpenScoutContext);
  if (!ctx) throw new Error('useOpenScout must be used inside OpenScoutProvider');
  return ctx;
}

export function OpenScoutProvider({ children }: { children: ReactNode }) {
  const { serviceApiUrl } = usePlatform();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [channel, setChannel] = useState<ChannelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${serviceApiUrl}/api/openscout`);
      const data = await res.json();
      setAgents(data.agents ?? []);
      setChannel(data.channelEntries ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [serviceApiUrl]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [refresh]);

  return (
    <OpenScoutContext.Provider value={{ agents, channel, loading, error, refresh, selectedAgent, setSelectedAgent }}>
      {children}
    </OpenScoutContext.Provider>
  );
}
