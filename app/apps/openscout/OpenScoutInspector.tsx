'use client';

import { useOpenScout } from './OpenScoutProvider';
import { Circle } from 'lucide-react';
import {
  formatOpenScoutAbsoluteTime,
  isOpenScoutAgentOnline,
  parseOpenScoutMessage,
} from './utils';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <span className="text-[10px] text-white/25 shrink-0">{label}</span>
      <span className="text-[11px] text-white/60 text-right truncate">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-white/20">{label}</div>
      <div className="mt-1 text-[14px] font-medium text-white/75">{value}</div>
    </div>
  );
}

export function OpenScoutInspector() {
  const {
    agents,
    channel,
    selectedAgentRecord,
    onlineCount,
    lastUpdatedAt,
    activityFilter,
    searchQuery,
  } = useOpenScout();
  const agent = selectedAgentRecord;

  if (!agent) {
    const topAgents = [...agents]
      .sort((left, right) => right.messageCount - left.messageCount)
      .slice(0, 5);

    return (
      <div className="p-3 space-y-3 overflow-y-auto h-full">
        <div className="space-y-1 px-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/18">Relay Overview</div>
          <div className="text-[12px] text-white/45">
            Scout workspace traffic, agent presence, and current console scope.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Agents" value={agents.length} />
          <MiniStat label="Live" value={`${onlineCount}/${agents.length || 0}`} />
          <MiniStat label="Messages" value={channel.length} />
          <MiniStat label="Synced" value={lastUpdatedAt ? formatOpenScoutAbsoluteTime(Math.floor(lastUpdatedAt / 1000)) : '—'} />
        </div>

        <div className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.06] bg-white/[0.02] px-3">
          <DetailRow label="Activity Filter" value={activityFilter} />
          <DetailRow label="Search" value={searchQuery || '—'} />
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/20">
            Top Agents
          </div>
          <div className="mt-2 space-y-2">
            {topAgents.length > 0 ? topAgents.map(candidate => (
              <div key={candidate.name} className="flex items-center justify-between gap-2 text-[11px]">
                <div className="min-w-0">
                  <div className="truncate text-white/70">{candidate.name}</div>
                  <div className="truncate text-white/20">{candidate.project}</div>
                </div>
                <div className="text-white/30">{candidate.messageCount}</div>
              </div>
            )) : (
              <div className="text-[11px] text-white/20">No Scout agents have reported in yet.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const online = isOpenScoutAgentOnline(agent.lastSeen);
  const agentEntries = channel.filter(entry => entry.agent === agent.name);
  const askCount = agentEntries.filter(entry => parseOpenScoutMessage(entry).tags.some(tag => tag.type === 'ask')).length;
  const replyCount = agentEntries.filter(entry => parseOpenScoutMessage(entry).tags.some(tag => tag.type === 'reply')).length;
  const speakCount = agentEntries.filter(entry => parseOpenScoutMessage(entry).tags.some(tag => tag.type === 'speak')).length;
  const systemCount = agentEntries.filter(entry => parseOpenScoutMessage(entry).isSystem).length;
  const recentEntries = agentEntries.slice(-4).reverse();

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {/* Agent header */}
      <div className="flex items-center gap-2.5 px-1 pb-2 border-b border-white/[0.06]">
        <Circle
          size={8}
          className={online ? 'text-emerald-400 fill-emerald-400' : 'text-neutral-600 fill-neutral-600'}
        />
        <div>
          <div className="text-[13px] font-medium text-white/80">{agent.name}</div>
          <div className="text-[10px] text-white/25">{online ? 'Online' : 'Offline'} · {agent.project}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Messages" value={agent.messageCount} />
        <MiniStat label="Last Seen" value={online ? 'live' : formatOpenScoutAbsoluteTime(agent.lastSeen)} />
        <MiniStat label="Asks" value={askCount} />
        <MiniStat label="Replies" value={replyCount} />
        <MiniStat label="Voice" value={speakCount} />
        <MiniStat label="System" value={systemCount} />
      </div>

      {/* Details */}
      <div className="divide-y divide-white/[0.04]">
        <DetailRow label="Project" value={agent.project} />
        {agent.cwd && <DetailRow label="Directory" value={agent.cwd.replace(/^\/Users\/\w+/, '~')} />}
        {agent.pid && <DetailRow label="PID" value={agent.pid} />}
        <DetailRow label="Messages" value={agent.messageCount} />
        <DetailRow label="Last seen" value={formatOpenScoutAbsoluteTime(agent.lastSeen)} />
        <DetailRow label="Registered" value={agent.registered ? 'Yes' : 'No'} />
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/20">
          Recent Activity
        </div>
        <div className="mt-2 space-y-2">
          {recentEntries.length > 0 ? recentEntries.map((entry, index) => {
            const parsed = parseOpenScoutMessage(entry);
            return (
              <div key={`${entry.timestamp}-${index}`} className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                <div className="flex items-center justify-between gap-2 text-[10px] text-white/25">
                  <span>{entry.type}</span>
                  <span>{formatOpenScoutAbsoluteTime(entry.timestamp)}</span>
                </div>
                <div className="mt-1 text-[11px] leading-relaxed text-white/60">
                  {parsed.body || 'No message body'}
                </div>
              </div>
            );
          }) : (
            <div className="text-[11px] text-white/20">No recent activity for this agent.</div>
          )}
        </div>
      </div>
    </div>
  );
}
