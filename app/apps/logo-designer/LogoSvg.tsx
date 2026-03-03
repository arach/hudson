'use client';
import type { LogoParams } from './LogoProvider';
import { useLogo } from './LogoProvider';
import { TemplateSvg } from './TemplateSvg';

interface Props {
  params: LogoParams;
  size: number;
}

export function LogoSvg({ params, size }: Props) {
  const { templates, customParamValues } = useLogo();
  const template = templates.find(t => t.id === params.variant);

  if (!template) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size}>
        <rect width="512" height="512" rx="40" fill="#1a1a1a" />
        <text x="256" y="256" textAnchor="middle" fill="#666" fontSize="16" fontFamily="monospace">
          Template not found
        </text>
      </svg>
    );
  }

  return (
    <TemplateSvg
      template={template}
      params={params}
      customParamValues={customParamValues[template.id] ?? {}}
      size={size}
    />
  );
}
