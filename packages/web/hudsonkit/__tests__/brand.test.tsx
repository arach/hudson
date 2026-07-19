import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HudsonKitLockup, HudsonKitMark } from '../src/components/brand';

afterEach(cleanup);

describe('HudsonKit brand', () => {
  it('renders the canonical four-panel mark with theme-aware color', () => {
    const { container } = render(<HudsonKitMark title="HudsonKit mark" size={32} />);
    const mark = screen.getByRole('img', { name: 'HudsonKit mark' });

    expect(mark).toHaveAttribute('viewBox', '0 0 64 64');
    expect(mark).toHaveAttribute('fill', 'currentColor');
    expect(mark).toHaveAttribute('width', '32');
    expect(container.querySelectorAll('path')).toHaveLength(4);
  });

  it('labels the lockup once and keeps its mark decorative', () => {
    const { container } = render(<HudsonKitLockup />);

    expect(screen.getByLabelText('HUDSONKIT')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container).toHaveTextContent('HUDSONKIT');
  });
});
