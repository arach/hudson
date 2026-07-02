'use client';

import { useEffect, useState } from 'react';
import { useInView, useTypewriter } from '@/marketing/lib/animate';

const SHIP_CMD = 'hudson ship --all';

export function ShipBlock() {
  const [ref, inView] = useInView<HTMLPreElement>({ threshold: 0.4 });
  const cmd = useTypewriter(SHIP_CMD, { inView, speed: 38, startDelay: 200 });
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!inView) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the ship animation stage when scrolled out of view (inView dep); a bounded reaction, not a per-render cascade
      setStage(0);
      return;
    }
    const timers = [
      setTimeout(() => setStage(1), 900),
      setTimeout(() => setStage(2), 1500),
      setTimeout(() => setStage(3), 2100),
      setTimeout(() => setStage(4), 2700),
      setTimeout(() => {
        setStage(5);
        window.__hudAudio?.chime?.({ cat: 'type' });
      }, 3200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  const ok = <span style={{ color: 'var(--accent)' }}>✓</span>;
  return (
    <pre ref={ref} className="code" style={{ margin: 0, minHeight: 168 }}>
      {'$ '}
      <span className="kw">{cmd}</span>
      {cmd.length === SHIP_CMD.length ? '' : <span style={{ opacity: 0.5 }}>▌</span>}
      {'\n'}
      {stage >= 1 && (
        <>
          <span className="com">  › building 3 surfaces…</span>
          {'\n'}
        </>
      )}
      {stage >= 2 && <>  {ok} ios     → TestFlight{'\n'}</>}
      {stage >= 3 && <>  {ok} macos   → notarized{'\n'}</>}
      {stage >= 4 && <>  {ok} web     → CDN{'\n'}</>}
      {stage >= 5 && (
        <>
          {'  '}
          <span className="com">3 surfaces · 0 forks · 41s</span>
        </>
      )}
    </pre>
  );
}
