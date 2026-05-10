'use client';

import type { CSSProperties } from 'react';
import { useOptionalWorkspaceDecor } from './WorkspaceDecorContext';
import type {
  DecorationItem,
  ImageDecor,
  StepCardDecor,
  TextDecor,
  WebDecor,
} from './types';
import './decoration-layer.css';

interface DecorationLayerProps {
  /** Current world scale — kept on the API for future hooks even though the
   *  layer itself is read-only and inherits the world transform. */
  worldScale: number;
}

/** Read-only render of the workspace's placards. The stage-design app is
 *  the sole authoring surface — this layer never reacts to pointer input
 *  so it can't compete with app windows for clicks or steal focus. */
export function DecorationLayer({ worldScale: _worldScale }: DecorationLayerProps) {
  const decor = useOptionalWorkspaceDecor();
  if (!decor || !decor.visible || decor.items.length === 0) return null;

  return (
    <div className="hudson-decor-layer" aria-hidden={false}>
      {decor.items.map((item) => (
        <DecorationItemView
          key={item.id}
          item={item}
          selected={decor.selectedId === item.id}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function DecorationItemView({ item, selected }: { item: DecorationItem; selected: boolean }) {
  const style: CSSProperties = {
    transform: `translate(${item.x}px, ${item.y}px)`,
    width: item.w,
    minHeight: item.h,
  };

  return (
    <div
      className={'hudson-decor-item' + (selected ? ' is-selected' : '')}
      data-decor-type={item.type}
      style={style}
    >
      <DecorationBody item={item} />
    </div>
  );
}

function DecorationBody({ item }: { item: DecorationItem }) {
  switch (item.type) {
    case 'text':
      return <TextBody item={item} />;
    case 'image':
      return <ImageBody item={item} />;
    case 'web':
      return <WebBody item={item} />;
    case 'step-card':
      return <StepCardBody item={item} />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Text — eyebrow / display-title / body / divider
// ─────────────────────────────────────────────────────────────────────────────

function TextBody({ item }: { item: TextDecor }) {
  if (item.subtype === 'eyebrow') {
    return <div className="hudson-decor-eyebrow">{item.text}</div>;
  }
  if (item.subtype === 'display-title') {
    if (item.accent && item.text.includes(item.accent)) {
      const [before, after] = item.text.split(item.accent);
      return (
        <h2 className="hudson-decor-title">
          {before}
          <em className="accent">{item.accent}</em>
          {after}
        </h2>
      );
    }
    return <h2 className="hudson-decor-title">{item.text}</h2>;
  }
  if (item.subtype === 'divider') {
    return (
      <div className="hudson-decor-divider">
        <span className="rule" />
        {item.text ? <span className="label">{item.text}</span> : null}
        <span className="rule" />
      </div>
    );
  }
  return <p className="hudson-decor-body">{item.text}</p>;
}

// ─────────────────────────────────────────────────────────────────────────────

function ImageBody({ item }: { item: ImageDecor }) {
  return (
    <figure className="hudson-decor-image">
      {item.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.src} alt={item.alt ?? ''} draggable={false} />
      ) : (
        <div className="hudson-decor-placeholder">No image source</div>
      )}
      {item.caption ? <figcaption>{item.caption}</figcaption> : null}
    </figure>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Web — link card only (no iframe). The canvas isn't an iframe sandbox, so
// keeping these as static cards avoids cross-origin loads, layout thrash, and
// surprise interactions. Open ↗ links out in a new tab.
// ─────────────────────────────────────────────────────────────────────────────

function WebBody({ item }: { item: WebDecor }) {
  return (
    <a
      className="hudson-decor-web hudson-decor-web-card"
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="hudson-decor-web-chrome">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
        <span className="hudson-decor-web-url">{hostname(item.url)}</span>
      </div>
      <div className="hudson-decor-web-fallback">
        <div className="hudson-decor-web-fallback-host">{hostname(item.url)}</div>
        <div className="hudson-decor-web-fallback-title">{item.title || item.url}</div>
        <div className="hudson-decor-web-fallback-hint">Open ↗</div>
      </div>
    </a>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function StepCardBody({ item }: { item: StepCardDecor }) {
  return (
    <div className="hudson-decor-step">
      <div className="hudson-decor-step-head">§ STEP {item.step}</div>
      <div className="hudson-decor-step-action">
        <span className="num">{item.step.replace(/^0/, '')}</span>
        <span className="verb">{item.verb}</span>
      </div>
      <div className="hudson-decor-step-body">{item.body}</div>
      {item.code ? <pre className="hudson-decor-step-code">{item.code}</pre> : null}
    </div>
  );
}
