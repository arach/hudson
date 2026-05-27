'use client';

import { HudLogger, HObservabilityDefault } from 'hudsonkit/observability';

export function HudLoggerContent() {
  return (
    <div className="h-full min-h-0 bg-background p-3 md:p-4">
      <HudLogger
        observability={HObservabilityDefault}
        maxEvents={240}
        title="hudlogger"
        className="h-full min-h-[520px]"
      />
    </div>
  );
}
