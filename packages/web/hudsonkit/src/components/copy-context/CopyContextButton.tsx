'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { agentCopy, type AgentCopyOptions } from '../../lib/agentCopy';
import { useCopyContextScope } from './CopyContextScope';

type ScopeResolver =
  | React.RefObject<Element | null>
  | (() => Element | null)
  | string;

export interface CopyContextButtonProps {
  /**
   * Explicit scope override. Use when the button sits outside the
   * `<CopyContextScope>` it should target (page-header copy for a region
   * deeper in the page). Accepts a ref, a getter, or a CSS selector.
   */
  scope?: ScopeResolver;
  label?: string;
  options?: AgentCopyOptions;
  className?: string;
}

function resolveScope(scope: ScopeResolver | undefined): Element | null {
  if (!scope) return null;
  if (typeof scope === 'string') return document.querySelector(scope);
  if (typeof scope === 'function') return scope();
  return scope.current;
}

export function CopyContextButton({
  scope,
  label = 'Copy for agent',
  options,
  className,
}: CopyContextButtonProps) {
  const ambient = useCopyContextScope();
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopy = async () => {
    try {
      const node = scope ? resolveScope(scope) : ambient?.getNode() ?? null;
      const sourceFn = !scope && ambient?.getSource ? ambient.getSource : null;
      const text = sourceFn ? sourceFn() : node ? agentCopy(node, options) : '';
      if (!text) {
        setState('error');
      } else {
        await navigator.clipboard.writeText(text);
        setState('copied');
      }
    } catch {
      setState('error');
    } finally {
      window.setTimeout(() => setState('idle'), 1500);
    }
  };

  const Icon = state === 'copied' ? Check : Copy;
  const text =
    state === 'copied' ? 'Copied' : state === 'error' ? 'Failed' : label;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={[
        'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-cyan-500/40 hover:text-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon size={12} />
      {text}
    </button>
  );
}
