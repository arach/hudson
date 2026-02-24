import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import type { HudsonApp } from '@hudson/sdk';

/**
 * Render a component inside an app's Provider.
 */
export function renderWithApp(
  app: HudsonApp,
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <app.Provider>{children}</app.Provider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Render an app slot component inside the app's Provider.
 */
export function renderAppSlot(app: HudsonApp, slotName: keyof HudsonApp['slots']) {
  const Slot = app.slots[slotName];
  if (!Slot) throw new Error(`App "${app.name}" has no slot "${slotName}"`);
  return renderWithApp(app, <Slot />);
}
