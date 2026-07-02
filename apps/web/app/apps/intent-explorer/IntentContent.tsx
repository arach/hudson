'use client';

import { IntentList } from './IntentList';
import { IntentDetailColumn } from './IntentDetailColumn';
import { IntentFloatingLayer } from './IntentFloatingLayer';

export function IntentContent() {
  return (
    <div className="h-full relative flex">
      {/* Scrollable grouped intent list */}
      <div className="flex-1 min-w-0">
        <IntentList />
      </div>

      {/* Animated detail column */}
      <IntentDetailColumn />

      {/* Floating cards overlay */}
      <IntentFloatingLayer />
    </div>
  );
}
