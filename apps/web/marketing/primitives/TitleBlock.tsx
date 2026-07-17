import { HudsonKitLockup } from 'hudsonkit';

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
        <HudsonKitLockup markSize={20} gap={10} />
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
