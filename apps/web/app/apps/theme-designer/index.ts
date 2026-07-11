import { createElement } from 'react';
import { Palette } from 'hudsonkit/icons';
import type { HudsonApp } from 'hudsonkit';
import { ThemeDesignerContent } from './ThemeDesignerContent';
import { ThemeDesignerInspector } from './ThemeDesignerInspector';
import { ThemeDesignerLeftPanel } from './ThemeDesignerLeftPanel';
import { ThemeDesignerProvider } from './ThemeDesignerProvider';
import {
  useThemeDesignerCommands,
  useThemeDesignerNavActions,
  useThemeDesignerNavCenter,
  useThemeDesignerStatus,
} from './hooks';

export const themeDesignerApp: HudsonApp = {
  id: 'theme-designer',
  name: 'Theme Designer',
  description: 'Visual editor for HudsonKit template and theme tokens',
  mode: 'panel',
  icon: createElement(Palette, { size: 15 }),

  Provider: ThemeDesignerProvider,

  leftPanel: {
    title: 'Themes',
    icon: createElement(Palette, { size: 12 }),
  },
  rightPanel: {
    title: 'Token Inspector',
    icon: createElement(Palette, { size: 12 }),
  },

  slots: {
    Content: ThemeDesignerContent,
    LeftPanel: ThemeDesignerLeftPanel,
    Inspector: ThemeDesignerInspector,
  },

  hooks: {
    useCommands: useThemeDesignerCommands,
    useStatus: useThemeDesignerStatus,
    useNavCenter: useThemeDesignerNavCenter,
    useNavActions: useThemeDesignerNavActions,
  },
};
