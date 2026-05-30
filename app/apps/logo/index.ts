import { Gem, SlidersHorizontal } from 'lucide-react';
import { createElement } from 'react';
import type { HudsonApp } from 'hudsonkit';
import { LogoProvider } from './LogoProvider';
import { LogoContent } from './LogoContent';
import { LogoLeftPanel } from './LogoLeftPanel';
import { LogoInspector, LogoInspectorHeaderActions } from './LogoInspector';
import { LogoTerminal } from './LogoTerminal';
import { LogoChat } from './LogoChat';
import { useLogoCommands, useLogoStatus } from './hooks';
import { useLogoCodeSurface } from './codeSurface';
import { useLogoPortOutput, useLogoPortInput } from './ports';
import { logoSettings } from './settings';
import { logoIntents } from './intents';

const IS_DEV_ENV = process.env.NODE_ENV === 'development';

export const logoApp: HudsonApp = {
  id: 'logo',
  name: 'Logo',
  description: 'Lattice logo designer and previewer',
  mode: 'panel',

  ports: {
    outputs: [
      { id: 'params', name: 'Logo Params', dataType: 'json', description: 'Current logo parameters as JSON' },
      { id: 'active-template-document', name: 'Active Template Document', dataType: 'json', description: 'Active logo template as an editable JavaScript document payload' },
      { id: 'active-template-source', name: 'Active Template Source', dataType: 'text', description: 'Active logo template JavaScript source file' },
      { id: 'animation-job', name: 'Animation Job', dataType: 'json', description: 'Selected logo variant payload for Preframe animation' },
    ],
    inputs: [
      { id: 'background-svg', name: 'Background SVG', dataType: 'svg', description: 'SVG to use as logo background layer' },
      { id: 'active-template-document', name: 'Template Document', dataType: 'json', description: 'Apply an edited logo template document back to the active template' },
      { id: 'active-template-source', name: 'Template Source', dataType: 'text', description: 'Apply edited JavaScript source back to the active template' },
    ],
  },

  code: {
    label: 'Template Code',
    commandLabel: 'Logo: View Template Code',
    placement: 'workbench',
    navAction: true,
    chat: true,
  },

  leftPanel: { title: 'Logo', icon: createElement(Gem, { size: 12 }) },
  rightPanel: { title: 'Inspector', icon: createElement(SlidersHorizontal, { size: 12 }), headerActions: LogoInspectorHeaderActions },

  Provider: LogoProvider,

  intents: logoIntents,

  settings: logoSettings,

  services: [
    { serviceId: 'relay', optional: true, reason: 'Required for AI terminal sessions and template compilation' },
    ...(IS_DEV_ENV
      ? [{ serviceId: 'preframe', optional: true, reason: 'Required for Logo animation render jobs' }]
      : []),
  ],

  // HUD-008: same-origin `/api/logo/...` defaults, `~/hudson/logo/.data` storage.
  backend: {},

  slots: {
    Content: LogoContent,
    LeftPanel: LogoLeftPanel,
    Inspector: LogoInspector,
    Chat: LogoChat,
    Terminal: LogoTerminal,
  },

  hooks: {
    useCommands: useLogoCommands,
    useStatus: useLogoStatus,
    useCodeSurface: useLogoCodeSurface,
    usePortOutput: useLogoPortOutput,
    usePortInput: useLogoPortInput,
  },
};
