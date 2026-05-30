'use client';

import { useCallback, useMemo, useState } from 'react';
import type { HudsonCodeChatMessage, HudsonCodeObject, HudsonCodeSurfaceState } from 'hudsonkit';
import { isBuiltinVariant, type LogoTemplate } from './types';
import { useLogo } from './LogoProvider';
import { logoTemplateToCodeDocumentPayload } from './ports';

function editableTemplateId(sourceId: string) {
  return `${sourceId}-edit-${Date.now().toString(36).slice(-5)}`;
}

export function useLogoCodeSurface(): HudsonCodeSurfaceState {
  const {
    params,
    templates,
    setVariant,
    addTemplate,
    updateTemplate,
    refreshTemplates,
    sendAiMessage,
    aiStatus,
    codeOpen,
    setCodeOpen,
  } = useLogo();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [chatMessages, setChatMessages] = useState<HudsonCodeChatMessage[]>([]);

  const activeTemplate = useMemo(
    () => templates.find(template => template.id === params.variant) ?? null,
    [params.variant, templates],
  );

  const payload = useMemo(
    () => activeTemplate ? logoTemplateToCodeDocumentPayload(activeTemplate) : null,
    [activeTemplate],
  );
  const value = activeTemplate && payload
    ? drafts[activeTemplate.id] ?? payload.value
    : '';
  const builtin = activeTemplate
    ? activeTemplate.builtin === true || isBuiltinVariant(activeTemplate.id)
    : false;

  const handleChange = useCallback((next: string) => {
    if (!activeTemplate) return;
    setDrafts(prev => ({ ...prev, [activeTemplate.id]: next }));
  }, [activeTemplate]);

  const handleSave = useCallback(async (next: string) => {
    if (!activeTemplate) return;
    if (activeTemplate.builtin === true || isBuiltinVariant(activeTemplate.id)) {
      throw new Error('Fork built-in templates before editing.');
    }
    await updateTemplate(activeTemplate.id, { sourceCode: next });
    await refreshTemplates();
    setDrafts(prev => {
      const out = { ...prev };
      delete out[activeTemplate.id];
      return out;
    });
  }, [activeTemplate, refreshTemplates, updateTemplate]);

  const handleFork = useCallback(async () => {
    if (!activeTemplate) return;
    const now = Date.now();
    const id = editableTemplateId(activeTemplate.id);
    const sourceCode = activeTemplate.sourceCode ?? activeTemplate.renderBody;
    const clone: LogoTemplate = {
      ...activeTemplate,
      id,
      name: `${activeTemplate.name} Edit`,
      description: activeTemplate.description,
      builtin: false,
      parentId: activeTemplate.id,
      sourceCode,
      renderBody: activeTemplate.renderBody,
      createdAt: now,
      updatedAt: now,
    };
    await addTemplate(clone);
    await refreshTemplates();
    setVariant(id);
    setCodeOpen(true);
  }, [activeTemplate, addTemplate, refreshTemplates, setVariant, setCodeOpen]);

  const handleChatSubmit = useCallback(async (prompt: string) => {
    if (!activeTemplate) return;
    const now = Date.now();
    setChatMessages(prev => [
      ...prev,
      {
        id: `logo-code-user:${now}`,
        role: 'user',
        content: prompt,
        timestamp: now,
      },
      {
        id: `logo-code-system:${now}`,
        role: 'system',
        content: 'Sent to Logo AI with the active template source as context.',
        timestamp: now,
      },
    ]);

    const templateKind = builtin ? 'built-in protected template' : 'editable custom template';
    sendAiMessage([
      `You are editing Logo Studio template code for "${activeTemplate.name}" (${activeTemplate.id}).`,
      `This is a ${templateKind}.`,
      builtin
        ? 'Do not mutate the built-in template directly. If a code change is requested, create a forked/editable template derived from this one.'
        : 'Apply requested code changes to this active template when appropriate.',
      '',
      'Current source:',
      '```js',
      value,
      '```',
      '',
      'User request:',
      prompt,
    ].join('\n'), {
      action: 'logo.code.edit',
      label: 'Edit template code',
      surface: 'logo-code-workbench',
    });
  }, [activeTemplate, builtin, sendAiMessage, value]);

  const object = useMemo<HudsonCodeObject | null>(() => {
    if (!activeTemplate || !payload) return null;
    return {
      id: `logo-template-code:${activeTemplate.id}`,
      title: activeTemplate.name,
      subtitle: `${activeTemplate.id}.js`,
      description: activeTemplate.description,
      document: {
        id: payload.id,
        title: payload.title,
        uri: payload.uri,
        mediaType: payload.mediaType,
        language: payload.language,
        kind: payload.kind,
        value,
        readOnly: builtin,
      },
      mode: builtin ? 'read' : 'edit',
      readOnlyReason: builtin ? 'Built-in templates are protected. Fork it to edit a copy.' : undefined,
      forkLabel: 'Fork',
      saveLabel: 'Save',
      onChange: builtin ? undefined : handleChange,
      onSave: builtin ? undefined : handleSave,
      onFork: builtin ? handleFork : undefined,
    };
  }, [activeTemplate, builtin, handleChange, handleFork, handleSave, payload, value]);

  return {
    id: 'logo:active-template-code',
    label: 'Template Code',
    object,
    open: codeOpen,
    setOpen: setCodeOpen,
    placement: 'workbench',
    chat: {
      title: 'Code Chat',
      placeholder: 'Ask AI to inspect, fork, or rewrite this template',
      messages: chatMessages,
      status: aiStatus === 'streaming' ? 'working' : 'idle',
      onSubmit: handleChatSubmit,
    },
  };
}
