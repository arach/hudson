export type TitleBlockProps = {
  sheet: string;
  total?: string;
  model?: string;
  rev?: string;
  drawnBy?: string;
  sheetTitle: string;
};

export function TitleBlock({
  sheet,
  total = '07',
  model = 'HDS-v1',
  rev = '04 / 05 / 26',
  drawnBy = 'A. Lin',
  sheetTitle,
}: TitleBlockProps) {
  return (
    <div className="titleblock titleblock--top-right">
      <div className="titleblock__cell titleblock__cell--full">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="8" width="16" height="16" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
          <rect x="13" y="13" width="6" height="6" fill="currentColor" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.22em' }}>HUDSONKIT</span>
      </div>
      <div className="titleblock__cell">
        <span className="titleblock__label">Model</span>
        <span className="titleblock__value">{model}</span>
      </div>
      <div className="titleblock__cell">
        <span className="titleblock__label">Rev</span>
        <span className="titleblock__value">{rev}</span>
      </div>
      <div className="titleblock__cell">
        <span className="titleblock__label">Drawn</span>
        <span className="titleblock__value">{drawnBy}</span>
      </div>
      <div className="titleblock__cell">
        <span className="titleblock__label">Scale</span>
        <span className="titleblock__value">1 : 1</span>
      </div>
      <div
        className="titleblock__cell titleblock__cell--full titleblock__cell--last"
        style={{ display: 'block' }}
      >
        <span className="titleblock__label">Sheet</span>
        <span className="titleblock__value">
          {sheet} / {total} &nbsp;·&nbsp; {sheetTitle}
        </span>
      </div>
    </div>
  );
}
