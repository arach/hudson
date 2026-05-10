import type { CSSProperties, ReactNode } from 'react';

export type EmbedFrameProps = {
  height?: number | string;
  padding?: number | string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function EmbedFrame({ height = 720, padding, className, style, children }: EmbedFrameProps) {
  const merged: CSSProperties = {
    height,
    ...(padding !== undefined ? { padding } : null),
    position: 'relative',
    ...style,
  };
  return (
    <div className={['embed-plate', className].filter(Boolean).join(' ')} style={merged}>
      <span className="embed-plate__corner embed-plate__corner--tl" />
      <span className="embed-plate__corner embed-plate__corner--tr" />
      <span className="embed-plate__corner embed-plate__corner--bl" />
      <span className="embed-plate__corner embed-plate__corner--br" />
      {children}
    </div>
  );
}
