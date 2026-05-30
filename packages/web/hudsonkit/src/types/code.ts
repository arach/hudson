import type { ReactNode } from 'react';
import type { HudsonTextDocument, TextDocumentMode } from '../components/controls/TextDocument';

export type HudsonCodeSurfacePlacement = 'workbench' | 'sheet' | 'inspector' | 'console' | 'inplace';
export type HudsonCodeWorkbenchSize = 'compact' | 'half' | 'full';

export interface HudsonCodeChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface HudsonCodeChatSurface {
  title?: string;
  placeholder?: string;
  messages?: HudsonCodeChatMessage[];
  status?: 'idle' | 'working' | 'error';
  error?: string | null;
  onSubmit?: (prompt: string, object: HudsonCodeObject) => void | Promise<void>;
}

export interface HudsonCodeObject {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: ReactNode;
  document: HudsonTextDocument;
  mode?: TextDocumentMode;
  readOnlyReason?: string;
  saveLabel?: string;
  forkLabel?: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void | Promise<void>;
  onFork?: (value: string) => void | Promise<void>;
}

export interface HudsonCodeSurfaceState {
  id: string;
  label?: string;
  object: HudsonCodeObject | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  placement?: HudsonCodeSurfacePlacement;
  chat?: HudsonCodeChatSurface;
}

export interface HudsonCodeSurfaceConfig {
  label?: string;
  commandLabel?: string;
  placement?: HudsonCodeSurfacePlacement;
  navAction?: boolean;
  chat?: boolean;
}
