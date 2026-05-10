import type { ReactNode } from 'react';

export type FooterPlateProps = {
  left?: [string, string];
  mid?: ReactNode;
  right?: [string, string];
};

export function FooterPlate({ left, mid, right }: FooterPlateProps) {
  return (
    <div className="footer-plate">
      {left && (
        <span>
          <span style={{ color: 'var(--ink-2)' }}>{left[0]}</span>&nbsp;
          <span className="footer-plate__strong">{left[1]}</span>
        </span>
      )}
      {left && <span className="footer-plate__divider" />}
      {mid && <span style={{ flex: 1 }}>{mid}</span>}
      {right && <span className="footer-plate__divider" />}
      {right && (
        <span>
          <span style={{ color: 'var(--ink-2)' }}>{right[0]}</span>&nbsp;
          <span className="footer-plate__strong">{right[1]}</span>
        </span>
      )}
    </div>
  );
}
