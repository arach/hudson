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
      <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[11px] text-foreground/75 text-right truncate">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
      <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[14px] font-medium text-foreground/85">{value}</div>
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
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Relay Overview</div>
          <div className="text-[12px] text-foreground/70">
            Scout workspace traffic, agent presence, and current console scope.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Agents" value={agents.length} />
          <MiniStat label="Live" value={`${onlineCount}/${agents.length || 0}`} />
          <MiniStat label="Messages" value={channel.length} />
          <MiniStat label="Synced" value={lastUpdatedAt ? formatOpenScoutAbsoluteTime(Math.floor(lastUpdatedAt / 1000)) : '—'} />
        </div>

        <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-muted/30 px-3">
          <DetailRow label="Activity Filter" value={activityFilter} />
          <DetailRow label="Search" value={searchQuery || '—'} />
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            Top Agents
          </div>
          <div className="mt-2 space-y-2">
            {topAgents.length > 0 ? topAgents.map(candidate => (
              <div key={candidate.name} className="flex items-center justify-between gap-2 text-[11px]">
                <div className="min-w-0">
                  <div className="truncate text-foreground/80">{candidate.name}</div>
                  <div className="truncate text-muted-foreground/80">{candidate.project}</div>
                </div>
                <div className="text-muted-foreground">{candidate.messageCount}</div>
              </div>
            )) : (
              <div className="text-[11px] text-muted-foreground/80">No Scout agents have reported in yet.</div>
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
      <div className="flex items-center gap-2.5 px-1 pb-2 border-b border-border/70">
        <Circle
          size={8}
          className={online ? 'text-success fill-[oklch(var(--success))]' : 'text-muted-foreground/60 fill-[oklch(var(--muted-foreground)/0.6)]'}
        />
        <div>
          <div className="text-[13px] font-medium text-foreground/85">{agent.name}</div>
          <div className="text-[10px] text-muted-foreground">{online ? 'Online' : 'Offline'} · {agent.project}</div>
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
      <div className="divide-y divide-border/60">
        <DetailRow label="Project" value={agent.project} />
        {agent.cwd && <DetailRow label="Directory" value={agent.cwd.replace(/^\/Users\/\w+/, '~')} />}
        {agent.pid && <DetailRow label="PID" value={agent.pid} />}
        <DetailRow label="Messages" value={agent.messageCount} />
        <DetailRow label="Last seen" value={formatOpenScoutAbsoluteTime(agent.lastSeen)} />
        <DetailRow label="Registered" value={agent.registered ? 'Yes' : 'No'} />
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          Recent Activity
        </div>
        <div className="mt-2 space-y-2">
          {recentEntries.length > 0 ? recentEntries.map((entry, index) => {
            const parsed = parseOpenScoutMessage(entry);
            return (
              <div key={`${entry.timestamp}-${index}`} className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>{entry.type}</span>
                  <span>{formatOpenScoutAbsoluteTime(entry.timestamp)}</span>
                </div>
                <div className="mt-1 text-[11px] leading-relaxed text-foreground/75">
                  {parsed.body || 'No message body'}
                </div>
              </div>
            );
          }) : (
            <div className="text-[11px] text-muted-foreground/80">No recent activity for this agent.</div>
          )}
        </div>
      </div>
    </div>
  );
}
