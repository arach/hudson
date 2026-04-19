'use client';

import { createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { usePlatform } from '@hudson/sdk';
import { useEventSourceInvalidation } from '../../hooks/useEventSourceInvalidation';
import {
  type OpenScoutActivityFilter,
  isOpenScoutAgentOnline,
  matchesOpenScoutActivityFilter,
  parseOpenScoutMessage,
} from './utils';

const FOCUSED_FALLBACK_POLL_MS = 15_000;
const VISIBLE_FALLBACK_POLL_MS = 60_000;

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
  filteredAgents: AgentInfo[];
  channel: ChannelEntry[];
  filteredChannel: ChannelEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  selectedAgent: string | null;
  setSelectedAgent: (name: string | null) => void;
  selectedAgentRecord: AgentInfo | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activityFilter: OpenScoutActivityFilter;
  setActivityFilter: (filter: OpenScoutActivityFilter) => void;
  activityCounts: Record<OpenScoutActivityFilter, number>;
  onlineCount: number;
  lastUpdatedAt: number | null;
}

const OpenScoutContext = createContext<OpenScoutState | null>(null);

export function useOpenScout() {
  const ctx = useContext(OpenScoutContext);
  if (!ctx) throw new Error('useOpenScout must be used inside OpenScoutProvider');
  return ctx;
}

export function OpenScoutProvider({
  children,
  disabled = false,
  visible = true,
  focused = false,
}: {
  children: ReactNode;
  disabled?: boolean;
  visible?: boolean;
  focused?: boolean;
}) {
  const { serviceApiUrl } = usePlatform();
  const streamUrl = `${serviceApiUrl}/api/openscout/stream`;
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [channel, setChannel] = useState<ChannelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<OpenScoutActivityFilter>('all');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  // Skip state updates when data hasn't changed to avoid unnecessary re-renders
  const lastJsonRef = useRef('');
  const refreshInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const res = await fetch(`${serviceApiUrl}/api/openscout`);
      const data = await res.json();
      const json = JSON.stringify(data);
      if (json !== lastJsonRef.current) {
        lastJsonRef.current = json;
        setAgents(data.agents ?? []);
        setChannel(data.channelEntries ?? []);
      }
      setLastUpdatedAt(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
    }
  }, [serviceApiUrl]);

  useEventSourceInvalidation({
    url: streamUrl,
    enabled: !disabled && visible,
    onInvalidate: refresh,
    fallbackIntervalMs: focused ? FOCUSED_FALLBACK_POLL_MS : VISIBLE_FALLBACK_POLL_MS,
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const selectedAgentRecord = useMemo(
    () => agents.find(agent => agent.name === selectedAgent) ?? null,
    [agents, selectedAgent],
  );
  const onlineCount = useMemo(
    () => agents.filter(agent => isOpenScoutAgentOnline(agent.lastSeen)).length,
    [agents],
  );
  const filteredAgents = useMemo(() => {
    if (!normalizedQuery) return agents;
    return agents.filter(agent => {
      const haystack = [
        agent.name,
        agent.project,
        agent.cwd ?? '',
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [agents, normalizedQuery]);

  const scopedChannel = useMemo(
    () => selectedAgent ? channel.filter(entry => entry.agent === selectedAgent) : channel,
    [channel, selectedAgent],
  );
  const searchedChannel = useMemo(() => {
    if (!normalizedQuery) return scopedChannel;
    return scopedChannel.filter(entry => {
      const parsed = parseOpenScoutMessage(entry);
      const haystack = [
        entry.agent,
        parsed.body,
        parsed.mentions.join(' '),
        parsed.tags.map(tag => tag.id ? `${tag.type}:${tag.id}` : tag.type).join(' '),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, scopedChannel]);
  const activityCounts = useMemo<Record<OpenScoutActivityFilter, number>>(() => ({
    all: searchedChannel.length,
    ask: searchedChannel.filter(entry => matchesOpenScoutActivityFilter(entry, 'ask')).length,
    reply: searchedChannel.filter(entry => matchesOpenScoutActivityFilter(entry, 'reply')).length,
    speak: searchedChannel.filter(entry => matchesOpenScoutActivityFilter(entry, 'speak')).length,
    system: searchedChannel.filter(entry => matchesOpenScoutActivityFilter(entry, 'system')).length,
  }), [searchedChannel]);
  const filteredChannel = useMemo(
    () => searchedChannel.filter(entry => matchesOpenScoutActivityFilter(entry, activityFilter)),
    [activityFilter, searchedChannel],
  );

  const value = useMemo<OpenScoutState>(() => ({
    agents,
    filteredAgents,
    channel,
    filteredChannel,
    loading,
    error,
    refresh,
    selectedAgent,
    setSelectedAgent,
    selectedAgentRecord,
    searchQuery,
    setSearchQuery,
    activityFilter,
    setActivityFilter,
    activityCounts,
    onlineCount,
    lastUpdatedAt,
  }), [
    activityCounts,
    activityFilter,
    agents,
    channel,
    error,
    filteredAgents,
    filteredChannel,
    lastUpdatedAt,
    loading,
    onlineCount,
    refresh,
    searchQuery,
    selectedAgent,
    selectedAgentRecord,
  ]);

  return (
    <OpenScoutContext.Provider value={value}>
      {children}
    </OpenScoutContext.Provider>
  );
}
