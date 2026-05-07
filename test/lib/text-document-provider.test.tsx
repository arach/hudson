import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextDocumentProvider, useTextDocument, type HudsonTextDocument } from 'hudsonkit';

const baseDocument: HudsonTextDocument = {
  id: 'doc-1',
  title: 'notes.md',
  kind: 'markdown',
  language: 'markdown',
  value: 'Initial',
};

function Probe() {
  const { dirty, savedValue, updateValue, value } = useTextDocument();
  return (
    <div>
      <output aria-label="value">{value}</output>
      <output aria-label="saved">{savedValue}</output>
      <output aria-label="dirty">{dirty ? 'dirty' : 'clean'}</output>
      <button type="button" onClick={() => updateValue('Local edit')}>
        edit
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
});
