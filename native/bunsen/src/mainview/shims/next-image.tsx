/**
 * Lightweight shim for next/image that renders a plain <img>.
 * Used by Vite builds where the Next.js image optimizer isn't available.
 */
import type { ImgHTMLAttributes } from 'react';

interface NextImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
}

export default function Image({ fill, priority, quality, ...rest }: NextImageProps) {
  return (
    <img
      {...rest}
      style={{
        ...(fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } : {}),
        ...rest.style,
      }}
    />
  );
}
