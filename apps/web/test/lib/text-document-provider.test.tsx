import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextDocumentProvider, useTextDocument, type HudsonTextDocument } from 'hudsonkit';

const baseDocument: HudsonTextDocument = {
  id: 'doc-1',
  title: 'notes.md',
  kind: 'markdown',
  language: 'markdown',
  value: 'Initial',
};

function Probe() {
  const { dirty, save, saveError, savedValue, saving, updateValue, value } = useTextDocument();
  return (
    <div>
      <output aria-label="value">{value}</output>
      <output aria-label="saved">{savedValue}</output>
      <output aria-label="dirty">{dirty ? 'dirty' : 'clean'}</output>
      <output aria-label="saving">{saving ? 'saving' : 'idle'}</output>
      <output aria-label="save-error">{saveError ?? ''}</output>
      <button type="button" onClick={() => updateValue('Local edit')}>
        edit
      </button>
      <button type="button" onClick={() => void save()}>
        save
      </button>
    </div>
  );
}

describe('TextDocumentProvider', () => {
  it('syncs same-id document replacements from the host', () => {
    const { rerender } = render(
      <TextDocumentProvider document={baseDocument}>
        <Probe />
      </TextDocumentProvider>,
    );

    rerender(
      <TextDocumentProvider document={{ ...baseDocument, value: 'Reloaded from disk' }}>
        <Probe />
      </TextDocumentProvider>,
    );

    expect(screen.getByLabelText('value')).toHaveTextContent('Reloaded from disk');
    expect(screen.getByLabelText('saved')).toHaveTextContent('Reloaded from disk');
    expect(screen.getByLabelText('dirty')).toHaveTextContent('clean');
  });

  it('does not mark parent echoes of local edits as saved', () => {
    const { rerender } = render(
      <TextDocumentProvider document={baseDocument}>
        <Probe />
      </TextDocumentProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));

    rerender(
      <TextDocumentProvider document={{ ...baseDocument, value: 'Local edit' }}>
        <Probe />
      </TextDocumentProvider>,
    );

    expect(screen.getByLabelText('value')).toHaveTextContent('Local edit');
    expect(screen.getByLabelText('saved')).toHaveTextContent('Initial');
    expect(screen.getByLabelText('dirty')).toHaveTextContent('dirty');
  });

  it('marks a document clean only after an async save succeeds', async () => {
    let finishSave: (() => void) | undefined;
    const onSave = vi.fn(() => new Promise<void>(resolve => { finishSave = resolve; }));
    render(
      <TextDocumentProvider document={baseDocument} onSave={onSave}>
        <Probe />
      </TextDocumentProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(screen.getByLabelText('saving')).toHaveTextContent('saving');
    expect(screen.getByLabelText('dirty')).toHaveTextContent('dirty');

    finishSave?.();
    await waitFor(() => expect(screen.getByLabelText('saving')).toHaveTextContent('idle'));
    expect(screen.getByLabelText('saved')).toHaveTextContent('Local edit');
    expect(screen.getByLabelText('dirty')).toHaveTextContent('clean');
  });

  it('keeps a document dirty and exposes the error when save fails', async () => {
    const onSave = vi.fn(async () => { throw new Error('disk full'); });
    render(
      <TextDocumentProvider document={baseDocument} onSave={onSave}>
        <Probe />
      </TextDocumentProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(screen.getByLabelText('save-error')).toHaveTextContent('disk full'));
    expect(screen.getByLabelText('dirty')).toHaveTextContent('dirty');
    expect(screen.getByLabelText('saved')).toHaveTextContent('Initial');
  });

  it('deduplicates saves while one is in flight', async () => {
    let finishSave: (() => void) | undefined;
    const onSave = vi.fn(() => new Promise<void>(resolve => { finishSave = resolve; }));
    render(
      <TextDocumentProvider document={baseDocument} onSave={onSave}>
        <Probe />
      </TextDocumentProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());

    finishSave?.();
    await waitFor(() => expect(screen.getByLabelText('dirty')).toHaveTextContent('clean'));
  });

  it('remains compatible with synchronous save callbacks', async () => {
    const onSave = vi.fn();
    render(
      <TextDocumentProvider document={baseDocument} onSave={onSave}>
        <Probe />
      </TextDocumentProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(screen.getByLabelText('dirty')).toHaveTextContent('clean'));
    expect(onSave).toHaveBeenCalledWith('Local edit');
  });
});
