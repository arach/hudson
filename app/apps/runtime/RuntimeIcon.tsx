'use client';

import type { SVGProps } from 'react';

export function RuntimeIcon({ size = 14, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  const stroke = 'currentColor';
  const fill = 'currentColor';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke={stroke} strokeWidth="1.1" opacity="0.35" />
      <rect x="2.5" y="3.2" width="4.6" height="3.4" rx="0.6" fill={fill} opacity="0.9" />
      <rect x="8.1" y="3.2" width="4.6" height="3.4" rx="0.6" fill={fill} opacity="0.55" />
      <rect x="2.5" y="7.8" width="4.6" height="3.4" rx="0.6" fill={fill} opacity="0.55" />
      <rect x="8.1" y="7.8" width="4.6" height="3.4" rx="0.6" fill={fill} opacity="0.35" />
      <circle cx="4.1" cy="4.4" r="0.55" fill={stroke} opacity="0.8" />
      <circle cx="9.7" cy="4.4" r="0.55" fill={stroke} opacity="0.55" />
    </svg>
  );
}
