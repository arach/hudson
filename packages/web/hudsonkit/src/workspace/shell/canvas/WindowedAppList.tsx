'use client';

import React, { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { WorkspaceAppConfig } from '../../../index';
import SkeletonWindow from '../skeletons/SkeletonWindow';

// ---------------------------------------------------------------------------
// WindowedAppList — extracted windowed-app render loop with skeleton support.
//
// This component owns the "windowed apps" section of MultiAppCanvas.
// It is designed to be a drop-in replacement for the inline `visibleWindowed`
// map in WorkspaceShell.tsx's MultiAppCanvas, with one additive behaviour:
//
//   When showSkeletons=true (e.g., the bounds map is empty because
//   usePersistentState hasn't resolved yet), it renders SkeletonWindow
//   placeholders at each app's `defaultWindowBounds` position instead of
//   trying to mount real app content early.
//
// The real window content is provided via the `renderWindow` render prop so
// this component stays decoupled from WorkspaceShell-private internals
// (WindowedApp, useWindowBounds, etc.).
//
// HOW TO WIRE IN (WorkspaceShell.tsx / MultiAppCanvas):
// -------------------------------------------------------
// Replace the "Windowed apps render inside AppWindow" AnimatePresence block:
//
//   <WindowedAppList
//     visibleWindowed={visibleWindowed}
//     windowResetKey={windowResetKey}
//     focusedAppId={focusedAppId}
//     zOrderMap={zOrderMap}
//     showSkeletons={Object.keys(windowBoundsMap).length === 0}
//     renderWindow={(config) => (
//       <WindowedApp
//         config={config}
//         workspaceId={workspace.id}
//         isFocused={config.app.id === focusedAppId}
//         onFocus={() => onFocusApp(config.app.id)}
//         onClose={() => onCloseApp(config.app.id)}
//         worldScale={worldScale}
//         onResetView={onResetView}
//         onReportBounds={onReportBounds}
//         onOpenServices={onOpenServices}
//         onOpenInspector={onOpenInspector}
//         navCenter={appHooksMap[config.app.id]?.navCenter ?? null}
//         onEnterFullscreen={() => onEnterFullscreen(config.app.id)}
//       />
//     )}
//   />
// ---------------------------------------------------------------------------

interface WindowedAppListProps {
  /** Windowed apps that are currently activated (visible). */
  visibleWindowed: WorkspaceAppConfig[];
  /**
   * Bumped to force remount on reset-all-windows. Used as part of the
   * motion key so React tears down and re-mounts each WindowedApp.
   */
  windowResetKey: number;
  /** Currently focused app ID — used for z-index and skeleton focus hint. */
  focusedAppId: string;
  /** z-index per app ID */
  zOrderMap: Record<string, number>;
  /**
   * When true, render SkeletonWindow placeholders instead of real windows.
   * Typically set to `Object.keys(windowBoundsMap).length === 0` to catch the
   * hydration gap before usePersistentState resolves.
   */
  showSkeletons: boolean;
  /**
   * Render prop that returns the real window content for a given app config.
   * Called only when showSkeletons=false.
   */
  renderWindow: (config: WorkspaceAppConfig) => ReactNode;
}

const WindowedAppList: React.FC<WindowedAppListProps> = ({
  visibleWindowed,
  windowResetKey,
  focusedAppId,
  zOrderMap,
  showSkeletons,
  renderWindow,
}) => {
  if (visibleWindowed.length === 0) return null;

  return (
    <AnimatePresence>
      {visibleWindowed.map(config => {
        const zIndex = zOrderMap[config.app.id] ?? 1;
        const key = `${config.app.id}-${windowResetKey}`;

        // -- Skeleton branch --------------------------------------------------
        if (showSkeletons) {
          const defaults = config.defaultWindowBounds ?? { x: 100, y: 100, w: 800, h: 600 };
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ zIndex, position: 'relative' }}
            >
              <SkeletonWindow
                bounds={defaults}
                title={config.app.name}
                isFocused={config.app.id === focusedAppId}
              />
            </motion.div>
          );
        }

        // -- Real window branch -----------------------------------------------
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ zIndex, position: 'relative' }}
          >
            {renderWindow(config)}
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
};

export default WindowedAppList;
