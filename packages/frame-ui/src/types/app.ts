import type { ReactNode } from 'react';
import type { CommandOption } from '../components/overlays/CommandPalette';
import type { AppIntent } from './intent';

// ---------------------------------------------------------------------------
// Status colors supported by StatusBar
// ---------------------------------------------------------------------------
export type StatusColor = 'emerald' | 'amber' | 'red' | 'neutral';

// ---------------------------------------------------------------------------
// Search configuration passed to NavigationBar
// ---------------------------------------------------------------------------
export interface SearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// HudsonApp — the contract every app must satisfy to plug into the shell.
// ---------------------------------------------------------------------------
export interface HudsonApp {
  /** Unique identifier (used as key + localStorage namespace) */
  id: string;
  /** Human-readable name shown in app switcher */
  name: string;
  /** Short description for tooltips / palette */
  description?: string;
  /** Frame mode: 'canvas' enables pan/zoom, 'panel' renders scrollable content */
  mode: 'canvas' | 'panel';

  /** Left panel header config */
  leftPanel?: { title: string; icon?: ReactNode; headerActions?: React.FC };
  /** Right panel header config */
  rightPanel?: { title: string; icon?: ReactNode };

  /** Wraps all slots — owns app state via React context */
  Provider: React.FC<{ children: ReactNode }>;

  /** Slot components rendered inside Provider */
  slots: {
    Content: React.FC;
    LeftPanel?: React.FC;
    RightPanel?: React.FC;
    LeftFooter?: React.FC;
    Terminal?: React.FC;
  };

  /** Static intent declarations for LLM/voice/search indexing */
  intents?: AppIntent[];

  /** Hooks called inside Provider via Bridge component */
  hooks: {
    useCommands: () => CommandOption[];
    useStatus: () => { label: string; color: StatusColor };
    useSearch?: () => SearchConfig;
    useNavCenter?: () => ReactNode | null;
    useNavActions?: () => ReactNode | null;
    useFrameMode?: () => 'canvas' | 'panel';
  };
}
