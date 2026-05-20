'use client';

import { useTerminalRelay, TerminalRelay, usePlatform, captureWorkspace } from 'hudsonkit';
import { AlertTriangle, Camera, Loader2 } from 'lucide-react';
import { useLogo } from './LogoProvider';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { buildSystemPrompt, buildClaudeMd } from './prompts';
import type { ModelTier } from './prompts';
import { useServiceRegistryContext } from '../../services/ServiceRegistryContext';

function isHostedBrowserDemo() {
  if (typeof window === 'undefined') return false;
  return !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

export function LogoTerminal() {
  const {
    params, presets, templates, customParamValues,
    appSettings, apiBaseUrl,
    consumeTerminalCommand,
  } = useLogo();

  const relayUrl = String(appSettings.relayUrl || 'ws://localhost:3600');
  const homeFolder = String(appSettings.homeFolder || '~/hudson/logos');
  const modelTier = (appSettings.modelTier as ModelTier) || 'comprehensive';
  const relayBackend = (appSettings.relayBackend as 'pty' | 'tmux') || 'pty';
  const relayAgent = appSettings.terminalAgent === 'pi' ? 'pi' : 'claude';
  const configuredProvider = String(appSettings.terminalProvider || 'minimax').trim();
  const configuredModel = String(appSettings.terminalModel || 'MiniMax-M2.7').trim();
  const relayProvider = relayAgent === 'pi' ? configuredProvider || 'minimax' : undefined;
  const relayModel = relayAgent === 'pi' ? configuredModel || 'MiniMax-M2.7' : undefined;
  const serviceRegistry = useServiceRegistryContext();
  const relayRecord = serviceRegistry.records.relay;
  const [hostedDemo, setHostedDemo] = useState(false);
  const relayServiceDown = !hostedDemo && relayRecord != null && relayRecord.status !== 'running';

  useEffect(() => {
    setHostedDemo(isHostedBrowserDemo());
  }, []);

  // ---- Relay session ----
  // Build a rich system prompt with full dynamic context
  const promptCtx = useMemo(() => ({
    params,
    presets: presets as { label: string; params: Partial<typeof params> }[],
    templates,
    customParamValues,
    homeFolder,
  }), [params, presets, templates, customParamValues, homeFolder]);

  const relaySystemPrompt = useMemo(() => buildSystemPrompt(promptCtx, modelTier), [promptCtx, modelTier]);

  // CLAUDE.md bootstrapped into the workspace — dynamic, reflects current session
  const workspaceFiles = useMemo(() => ({
    'CLAUDE.md': buildClaudeMd(promptCtx),
  }), [promptCtx]);

  const relay = useTerminalRelay({
    url: relayUrl,
    systemPrompt: relaySystemPrompt,
    cwd: homeFolder,
    workspaceFiles,
    sessionKey: 'logo',
    backend: relayBackend,
    tmuxSession: relayBackend === 'tmux' ? 'hudson-logos' : undefined,
    agent: relayAgent,
    provider: relayAgent === 'pi' ? relayProvider : undefined,
    model: relayAgent === 'pi' ? relayModel : undefined,
  });

  // ---- Consume pending commands from toolbar (e.g. Refine button) ----
  useEffect(() => {
    const id = setInterval(() => {
      const cmd = consumeTerminalCommand();
      if (cmd && relay.status === 'connected') {
        relay.sendLine(cmd);
      }
    }, 300);
    return () => clearInterval(id);
  }, [consumeTerminalCommand, relay]);

  // Config summary for the relay disconnected CTA
  const relayConfigItems = useMemo(() => [
    { label: 'Relay', value: relayUrl },
    { label: 'CWD', value: homeFolder },
    { label: 'CLI', value: relayAgent },
    ...(relayAgent === 'pi'
      ? [
          { label: 'Provider', value: relayProvider ?? 'minimax' },
          { label: 'Model', value: relayModel ?? 'MiniMax-M2.7' },
        ]
      : []),
  ], [relayUrl, homeFolder, relayAgent, relayProvider, relayModel]);

  // Start relay service via the service API
  const { serviceApiUrl } = usePlatform();
  const handleStartRelay = useCallback(async (): Promise<boolean> => {
    if (hostedDemo) return false;
    try {
      const res = await fetch(`${serviceApiUrl}/api/services/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'relay', action: 'start', triggeredBy: 'user' }),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }, [hostedDemo, serviceApiUrl]);

  // Open workspace manager via keyboard shortcut dispatch
  const openSettings = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ',',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    }));
  }, []);

  const [snapping, setSnapping] = useState(false);
  const handleScreenshot = useCallback(async () => {
    if (snapping || relay.status !== 'connected') return;
    setSnapping(true);
    try {
      const blob = await captureWorkspace();
      if (!blob) return;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = new File([blob], `snap-${ts}.jpg`, { type: 'image/jpeg' });
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${apiBaseUrl}/api/relay/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, data: base64 }),
      });
      const { path } = (await res.json()) as { path: string };
      if (path) relay.sendInput(path);
    } finally {
      setSnapping(false);
    }
  }, [snapping, relay, apiBaseUrl]);

  return (
    <div className="flex flex-col h-full">
      {/* Header — right-aligned controls */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/60 bg-muted/40">
        {relay.status === 'connected' && (
          <button
            type="button"
            onClick={handleScreenshot}
            disabled={snapping}
            className="p-1 rounded text-muted-foreground/80 hover:text-info/80 disabled:opacity-30 transition-colors"
            title="Capture workspace screenshot and send to agent"
          >
            {snapping ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          </button>
        )}
        <div className="flex-1" />
        {relay.status !== 'connected' && !hostedDemo && (
          <button
            type="button"
            onClick={() => relay.connect()}
            className="text-[10px] px-2 py-0.5 rounded-full border text-accent border-accent/30 hover:bg-accent/10 transition-colors"
          >
            Connect
          </button>
        )}
        {relay.status === 'connected' && (
          <>
            <button
              type="button"
              onClick={() => relay.restart()}
              className="text-[10px] px-2 py-0.5 rounded-full border text-info border-info/30 hover:bg-info/10 transition-colors"
              title="Kill session and start fresh (picks up new agent/model settings)"
            >
              Restart
            </button>
            <button
              type="button"
              onClick={() => relay.disconnect()}
              className="text-[10px] px-2 py-0.5 rounded-full border text-destructive border-destructive/30 hover:bg-destructive/10 transition-colors"
            >
              Disconnect
            </button>
          </>
        )}
      </div>
      {relayServiceDown && (
        <div className="shrink-0 flex items-center gap-2.5 px-3 py-2 border-b border-border/60 bg-muted/60 text-[11px]">
          <AlertTriangle size={12} className="text-warning/80 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-foreground/90">Logo terminal is offline.</span>{' '}
            <span className="text-muted-foreground">
              Hudson Relay powers terminal sessions here; logo editing still works without it.
            </span>
          </div>
          <button
            type="button"
            onClick={() => { void handleStartRelay(); }}
            className="text-[10px] px-2.5 py-1 rounded-full border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
          >
            Start Relay
          </button>
          <button
            type="button"
            onClick={openSettings}
            className="text-[10px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground/80 hover:bg-muted/40 transition-colors"
          >
            Services
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <TerminalRelay relay={relay} configItems={relayConfigItems} onOpenSettings={openSettings} onStartService={handleStartRelay} />
      </div>
    </div>
  );
}
