import type { ReactNode } from 'react';
import type { CommandOption } from '../components/overlays/CommandPalette';
import type { AppIntent } from './intent';
import type { AppPorts } from './port';
import type { ServiceDependency } from './service';

// ---------------------------------------------------------------------------
// App-level settings
// ---------------------------------------------------------------------------

export interface AppSettingField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'toggle' | 'slider' | 'segment' | 'select';
  default: string | number | boolean;
  /** For segment/select type */
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
// TakeoverState — return type of useTakeover hook
// ---------------------------------------------------------------------------
export interface TakeoverState {
  /** Whether the Takeover slot should be rendered full-viewport above chrome. */
  active: boolean;
  /** When true, the shell renders a close affordance and handles Escape. */
  dismissible: boolean;
  /** Called by the shell's close affordance / Escape when dismissible.
   *  The app decides what "dismiss" means — typically flipping its own state
   *  so the next render returns active: false. */
  onDismiss?: () => void;
}

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
/** How many live instances of this app a workspace can hold.
 *  - 'singleton' (default) — exactly one window per workspace
 *  - 'spawnable'  — shell can mint fresh instances on demand (e.g. terminal)
 *  - 'duplicable' — shell can clone an existing instance's state (e.g. logo designer)
 *  Both 'spawnable' and 'duplicable' may be combined behaviourally — an app that
 *  declares 'duplicable' also supports fresh spawn; a 'spawnable' app does not
 *  advertise a Duplicate gesture. */
export type MultiInstanceMode = 'singleton' | 'spawnable' | 'duplicable';

export interface HudsonApp {
  /** Unique identifier (used as key + localStorage namespace) */
  id: string;
  /** Human-readable name shown in app switcher */
  name: string;
  /** Short description for tooltips / palette */
  description?: string;
  /** Frame mode: 'canvas' enables pan/zoom, 'panel' renders scrollable content */
  mode: 'canvas' | 'panel';
  /** Icon shown next to the app name in the navigation bar */
  icon?: ReactNode;
  /** Whether the shell is allowed to mount more than one live instance of this
   *  app inside a single workspace. Defaults to 'singleton'. */
  multiInstance?: MultiInstanceMode;

  /** Left panel header config */
  leftPanel?: { title: string; icon?: ReactNode; headerActions?: React.FC };
  /** Right panel header config */
  rightPanel?: { title: string; icon?: ReactNode; headerActions?: React.FC };

  /** Wraps all slots — owns app state via React context.
   *  `disabled` is true when the app is disabled in the workspace.
   *  `visible` is true when the app is currently shown in the workspace.
   *  `focused` is true when the app is the active target for shell interactions.
   *  Providers should pause expensive work when disabled or hidden, and reserve
   *  any high-frequency polling/subscriptions for focused states only. */
  Provider: React.FC<{ children: ReactNode; disabled?: boolean; visible?: boolean; focused?: boolean }>;

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
    /** Full-viewport component rendered above the shell when useTakeover
     *  returns active. When present, the rest of the shell is marked
     *  `inert` + `aria-hidden`. Used for first-run setup, onboarding, or any
     *  flow that must block app interaction until completed or dismissed. */
    Takeover?: React.FC;
  };

  /** Static intent declarations for LLM/voice/search indexing */
  intents?: AppIntent[];

  /** Serializable manifest for tooling/LLM introspection */
  manifest?: AppManifest;

  /** App-level settings rendered in the Settings panel */
  settings?: AppSettingsConfig;

  /** Static port declarations for inter-app data piping */
  ports?: AppPorts;

  /** Services this app depends on */
  services?: ServiceDependency[];

  /** Hooks called inside Provider via Bridge component */
  hooks: {
    useCommands: () => CommandOption[];
    useStatus: () => { label: string; color: StatusColor };
    useSearch?: () => SearchConfig;
    useNavCenter?: () => ReactNode | null;
    useNavActions?: () => ReactNode | null;
    useLayoutMode?: () => 'canvas' | 'panel' | 'focus';
    useActiveToolHint?: () => string | null;
    /** Returns a getter: (portId) => data snapshot or null */
    usePortOutput?: () => (portId: string) => unknown | null;
    /** Returns a setter: (portId, data) => void */
    usePortInput?: () => (portId: string, data: unknown) => void;
    /** Controls the Takeover slot. Return null or active:false to pass through
     *  to the normal shell; return active:true to mount the Takeover slot
     *  above chrome. AppShell is stateless about dismissal — the hook's own
     *  state is what persists or clears the takeover. */
    useTakeover?: () => TakeoverState | null;
  };
}
