import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerProvider, PlayerWidget, usePlayer, type MediaItem } from 'hudsonkit/player';

function LoadMedia({ media }: { media: MediaItem }) {
  const { loadMedia } = usePlayer();

  useEffect(() => {
    loadMedia(media);
  }, [loadMedia, media]);

  return null;
}

describe('PlayerWidget', () => {
  it('does not render a status bar pill while empty and closed', () => {
    render(
      <PlayerProvider>
        <PlayerWidget />
      </PlayerProvider>,
    );

    expect(screen.queryByRole('button', { name: 'Open Player' })).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--hud-player-status-inline-offset')).toBe('');
  });

  it('renders the status bar pill once media is loaded', async () => {
    render(
      <PlayerProvider>
        <LoadMedia
          media={{
            id: 'demo-track',
            kind: 'audio',
            src: '/demo.mp3',
            title: 'Demo Track',
          }}
        />
        <PlayerWidget />
      </PlayerProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Player' })).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--hud-player-status-inline-offset')).toBe('118px');
  });
});
