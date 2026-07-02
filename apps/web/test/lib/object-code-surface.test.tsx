import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ObjectCodeSurface, ObjectCodeWorkbench, type HudsonCodeObject } from 'hudsonkit';

function textCodeObject(overrides: Partial<HudsonCodeObject> = {}): HudsonCodeObject {
  return {
    id: 'object-1',
    title: 'Template',
    subtitle: 'template.js',
    document: {
      id: 'doc-1',
      title: 'template.js',
      kind: 'text',
      language: 'plain',
      value: 'initial',
    },
    ...overrides,
  };
}

describe('ObjectCodeSurface', () => {
  it('saves the current object code value', async () => {
    const onSave = vi.fn();
    const onChange = vi.fn();

    render(
      <ObjectCodeSurface
        object={textCodeObject({ onChange, onSave })}
        placement="inplace"
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'edited' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onChange).toHaveBeenCalledWith('edited');
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('edited'));
  });

  it('offers fork for protected objects instead of save', async () => {
    const onFork = vi.fn();

    render(
      <ObjectCodeSurface
        object={textCodeObject({
          document: {
            id: 'doc-1',
            title: 'template.js',
            kind: 'text',
            language: 'plain',
            value: 'protected',
            readOnly: true,
          },
          readOnlyReason: 'Protected object',
          onFork,
        })}
        placement="inplace"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fork' }));

    await waitFor(() => expect(onFork).toHaveBeenCalledWith('protected'));
    expect(screen.getByText('Protected object')).toBeInTheDocument();
  });
});

describe('ObjectCodeWorkbench', () => {
  it('resizes and submits code chat turns', async () => {
    const onSizeChange = vi.fn();
    const onEditorWidthChange = vi.fn();
    const onChatWidthChange = vi.fn();
    const onSubmit = vi.fn();
    const object = textCodeObject();

    render(
      <ObjectCodeWorkbench
        object={object}
        size="half"
        onSizeChange={onSizeChange}
        onClose={() => {}}
        editorWidth={420}
        chatWidth={320}
        onEditorWidthChange={onEditorWidthChange}
        onChatWidthChange={onChatWidthChange}
        chat={{ onSubmit, placeholder: 'Ask for a code edit' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(onSizeChange).toHaveBeenCalledWith('full');

    fireEvent.click(screen.getByRole('button', { name: 'Code chat' }));

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize code and chat panes' }), {
      key: 'ArrowRight',
    });
    expect(onEditorWidthChange).toHaveBeenCalledWith(452);
    expect(onChatWidthChange).toHaveBeenCalledWith(288);

    fireEvent.change(screen.getByPlaceholderText('Ask for a code edit'), {
      target: { value: 'Make the template simpler' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code turn' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Make the template simpler', object));
  });
});
