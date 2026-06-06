'use client';

import { HudLogger, HObservabilityDefault } from 'hudsonkit/observability';
import { useAgentActionLog } from 'hudsonkit/workspace';

export function HudLoggerContent() {
  const replayEvents = useAgentActionLog({ limit: 240, refreshMs: 5000 });

  return (
    <div className="h-full min-h-0 bg-background p-3 md:p-4">
      <HudLogger
        observability={HObservabilityDefault}
        replayEvents={replayEvents}
        maxEvents={240}
        title="agent actions"
        className="h-full min-h-[520px]"
        emptyMessage="No agent actions yet."
        initialScope="agent-actions"
      />
    </div>
  );
}
