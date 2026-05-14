'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/app');
  }, [router]);
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        color: 'oklch(var(--muted-foreground, 0.55 0 0))',
        fontSize: 13,
        gap: 16,
        flexDirection: 'column',
      }}
    >
      <div>Redirecting to the workspace…</div>
      <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
        <a href="/app" style={{ color: 'inherit', textDecoration: 'underline' }}>
          /app — product
        </a>
        <a href="/landing" style={{ color: 'inherit', textDecoration: 'underline' }}>
          /landing — marketing
        </a>
      </div>
    </main>
  );
}
