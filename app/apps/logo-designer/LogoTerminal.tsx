'use client';

import { useHudsonAI, AI } from '@hudson/sdk';
import { useLogo } from './LogoProvider';

export function LogoTerminal() {
  const { params, setParam, setVariant, resetDefaults, presets } = useLogo();

  const chat = useHudsonAI({
    toolset: 'logo',
    context: { params, presetNames: presets.map(p => p.label) },
    onToolCall: (name, args) => {
      switch (name) {
        case 'set_param':
          setParam(args.key as keyof typeof params, args.value as never);
          break;
        case 'set_variant':
          setVariant(args.variant as typeof params.variant);
          break;
        case 'apply_preset': {
          const p = presets.find(
            pr => pr.label.toLowerCase() === (args.preset_label as string).toLowerCase(),
          );
          if (p) Object.entries(p.params).forEach(([k, v]) => setParam(k as keyof typeof params, v as never));
          break;
        }
        case 'reset_defaults':
          resetDefaults();
          break;
      }
    },
  });

  return <AI chat={chat} placeholder="Describe what you want the logo to look like..." />;
}
