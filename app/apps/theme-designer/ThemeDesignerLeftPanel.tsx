'use client';

import { Download, FileCode2, Save, Upload, Clipboard, Link2, CopyPlus } from 'lucide-react';
import { BUILT_IN_TEMPLATE_IDS, THEME_MODES, templateLabel } from './model';
import { useThemeDesigner } from './ThemeDesignerProvider';

function PanelButton({ children, onClick, disabled, title }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-foreground/80 transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

export function ThemeDesignerLeftPanel() {
  const designer = useThemeDesigner();
  const builtIn = (BUILT_IN_TEMPLATE_IDS as readonly string[]).includes(designer.selectedTemplateId);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex-1 space-y-4 overflow-y-auto p-3 frame-scrollbar">
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Matrix</div>
            <div className="rounded-full border border-border bg-muted px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
              {designer.selectedMode}
            </div>
          </div>

          <div className="space-y-1.5">
            {designer.templates.map(template => (
              <div key={template.id} className="rounded-lg border border-border bg-card/70 p-1.5">
                <button
                  type="button"
                  onClick={() => designer.setSelectedTemplateId(template.id)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    designer.selectedTemplateId === template.id
                      ? 'bg-accent/10 text-accent'
                      : 'text-foreground/85 hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="min-w-0 truncate text-[12px] font-medium">{templateLabel(template.id)}</span>
                  <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
                    {template.id}
                  </span>
                </button>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  {THEME_MODES.map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        designer.setSelectedTemplateId(template.id);
                        designer.setSelectedMode(mode);
                      }}
                      className={`rounded border px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        designer.selectedTemplateId === template.id && designer.selectedMode === mode
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-lg border border-border bg-card/70 p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Save target</div>
          <label className="block space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Template id</span>
            <input
              value={designer.exportTemplateId}
              onChange={event => designer.setExportTemplateId(event.target.value)}
              placeholder={builtIn ? `${designer.selectedTemplateId}-custom` : designer.selectedTemplateId}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <input
              type="checkbox"
              checked={designer.registerRef}
              onChange={event => designer.setRegisterRef(event.target.checked)}
              className="accent-accent"
            />
            Register ?ref preset
          </label>
          {designer.registerRef && (
            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Preset ref</span>
              <input
                value={designer.refId}
                onChange={event => designer.setRefId(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <PanelButton onClick={designer.createCopy} title="Create an in-memory copy before saving">
              <CopyPlus size={12} /> Copy
            </PanelButton>
            <PanelButton onClick={designer.saveTemplate} disabled={!designer.isDev} title={designer.isDev ? 'Write tokens.css' : 'File writes are dev-only'}>
              <Save size={12} /> Save
            </PanelButton>
          </div>
          <div className="rounded-md border border-border bg-muted/50 p-2 text-[10px] leading-relaxed text-muted-foreground">
            {designer.saveStatus}
          </div>
        </section>

        <section className="space-y-2 rounded-lg border border-border bg-card/70 p-3">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            <FileCode2 size={12} /> Export
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PanelButton onClick={designer.copyCss}><Clipboard size={12} /> CSS</PanelButton>
            <PanelButton onClick={designer.downloadCss}><Download size={12} /> File</PanelButton>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Link2 size={11} /> Embed ref
            </div>
            <code className="block break-all rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {designer.refSnippet}
            </code>
          </div>
        </section>

        <section className="space-y-2 rounded-lg border border-border bg-card/70 p-3">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            <Upload size={12} /> Import CSS
          </div>
          <textarea
            value={designer.importCss}
            onChange={event => designer.setImportCss(event.target.value)}
            placeholder={'[data-hudson-template="example"][data-hudson-theme="dark"] {\n  --background: 0.2 0.02 240;\n}'}
            className="min-h-28 w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-relaxed text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/25"
          />
          <PanelButton onClick={designer.importFromCss} disabled={!designer.importCss.trim()}>
            <Upload size={12} /> Import block
          </PanelButton>
        </section>
      </div>
    </div>
  );
}
