import type { CSSProperties, ReactNode } from 'react';
import { InlineDraftingToolbar } from '@/marketing/lib/fx/InlineDraftingToolbar';
import { FooterPlate, type FooterPlateProps } from './FooterPlate';

export type SheetProps = {
  id: string;
  num: string;
  total?: string;
  slugTitle: string;
  slugSub?: string;
  sheetTitle: string;
  footer?: FooterPlateProps;
  className?: string;
  style?: CSSProperties;
  screenLabel?: string;
  children: ReactNode;
};

// Padding is driven by a CSS variable so the responsive cascade in site.css
// can collapse it on phones (16px gutters) without each sheet having to
// override its inline style. The sticky header relies on this same variable
// for its negative margins so its rule still extends edge-to-edge.
const DEFAULT_STYLE: CSSProperties = {
  padding: '0 var(--sheet-pad-x, 64px) var(--sheet-pad-bottom, 72px)',
  position: 'relative',
};

export function Sheet({
  id,
  num,
  total = '07',
  slugTitle,
  slugSub,
  sheetTitle,
  footer,
  className,
  style,
  screenLabel,
  children,
}: SheetProps) {
  return (
    <section
      id={id}
      data-screen-label={screenLabel ?? `${num} ${slugTitle}`}
      className={['sheet sheet--bordered', className].filter(Boolean).join(' ')}
      style={{ ...DEFAULT_STYLE, ...style }}
    >
      <div className="sheet__rule--left" />

      <header className="sheet-header">
        <div className="sheet-header__rule" />
        <div className="sheet-header__bar">
          <div className="sheet-header__brand">HUDSONKIT</div>

          <div className="sheet-header__title">
            <span className="sheet-header__title-badge">
              <span className="sheet-header__title-badge-num">{num}</span>
              <span className="sheet-header__title-badge-name">{slugTitle}</span>
            </span>
            <span className="sheet-header__title-cell">
              <span className="sheet-header__title-label">Title</span>
              <span className="sheet-header__title-value">{sheetTitle}</span>
            </span>
            <span className="sheet-header__title-cell sheet-header__title-cell--end">
              <span className="sheet-header__title-label">Sheet</span>
              <span className="sheet-header__title-value">
                {num} / {total}
              </span>
            </span>
          </div>

          <InlineDraftingToolbar className="sheet-header__tools" />
        </div>
      </header>

      <div className="sheet-body">
        {children}
        {footer && <FooterPlate {...footer} />}
      </div>
    </section>
  );
}
