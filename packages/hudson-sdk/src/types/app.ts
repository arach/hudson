import type { ReactNode } from 'react';
import type { CommandOption } from '../components/overlays/CommandPalette';
import type { AppIntent } from './intent';
import type { ServiceDependency } from './service';

// ---------------------------------------------------------------------------
// App-level settings
// ---------------------------------------------------------------------------

export interface AppSettingField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'toggle' | 'slider' | 'segment';
  default: string | number | boolean;
  /** For segment type */
  options?: { value: string; label: string }[];
  /** For slider/number type */
  min?: number;
  max?: number;
  step?: number;
  /** For slider: format display string */
  format?: (v: number) => string;
}

export interface AppSettingsSection {
  label: string;
  fields: AppSettingField[];
}

export interface AppSettingsConfig {
  sections: AppSettingsSection[];
}

// ---------------------------------------------------------------------------
// Status colors supported by StatusBar
// ---------------------------------------------------------------------------
export type StatusColor = 'emerald' | 'amber' | 'red' | 'neutral';

// ---------------------------------------------------------------------------
// AppTool — a tool that appears in the right sidebar's accordion
// ---------------------------------------------------------------------------
export interface AppTool {
  id: string;
  name: string;
  icon: ReactNode;
  Component: React.FC;
}

// ---------------------------------------------------------------------------
// Search configuration passed to NavigationBar
// ---------------------------------------------------------------------------
export interface SearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// AppManifest — serializable snapshot of an app's capabilities
// ---------------------------------------------------------------------------
export interface AppManifest {
  id: string;
  name: string;
  description?: string;
  mode: 'canvas' | 'panel';
  commands?: { id: string; label: string; shortcut?: string }[];
  tools?: { id: string; name: string }[];
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

  /** Interactive tool panels for the right sidebar accordion */
  tools?: AppTool[];

  /** Slot components rendered inside Provider */
  slots: {
    Content: React.FC;
    LeftPanel?: React.FC;
    /** @deprecated Use Inspector + tools instead */
    RightPanel?: React.FC;
    Inspector?: React.FC;
    LeftFooter?: React.FC;
    Terminal?: React.FC;
  };

  /** Static intent declarations for LLM/voice/search indexing */
  intents?: AppIntent[];

  /** Serializable manifest for tooling/LLM introspection */
  manifest?: AppManifest;

  /** App-level settings rendered in the Settings panel */
  settings?: AppSettingsConfig;

  /** Services this app depends on */
  services?: ServiceDependency[];

  /** Hooks called inside Provider via Bridge component */
  hooks: {
    useCommands: () => CommandOption[];
    useStatus: () => { label: string; color: StatusColor };
    useSearch?: () => SearchConfig;
    useNavCenter?: () => ReactNode | null;
    useNavActions?: () => ReactNode | null;
    useLayoutMode?: () => 'canvas' | 'panel';
    useActiveToolHint?: () => string | null;
  };
}
