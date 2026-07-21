'use client';

import React, { useMemo } from 'react';
import { Select } from '@base-ui-components/react/select';
import { ChevronDown } from 'lucide-react';
import {
  chromeBorderStyle,
  OVERLAY_ITEM,
  OVERLAY_ITEM_CHECK,
  OVERLAY_POPUP_SELECT,
  OVERLAY_POSITIONER,
} from '../overlays/menuChrome';

export type HudSelectBaseDensity = 'default' | 'compact';

export interface HudSelectBaseOption {
  value: string;
  label: string;
}

/**
 * Drop-in API compatible with native HudSelect call sites that want a popup:
 * compact mono trigger, `options` list, native-ish `onChange` with `event.target.value`.
 *
 * Named *Base* because `HudSelect` already ships as a native `<select>` skin.
 * Prefer this when the surface needs a popup that shares menu chrome with HudMenu.
 */
export interface HudSelectBaseProps {
  options: HudSelectBaseOption[];
  value?: string;
  defaultValue?: string | null;
  onChange?: (event: { target: { value: string } }) => void;
  onValueChange?: (value: string | null) => void;
  density?: HudSelectBaseDensity;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
  title?: string;
  placeholder?: string;
}

export const HudSelectBase = React.forwardRef<HTMLButtonElement, HudSelectBaseProps>(
  function HudSelectBase(
    {
      options,
      value,
      defaultValue = null,
      onChange,
      onValueChange,
      density = 'default',
      invalid = false,
      disabled = false,
      required = false,
      name,
      id,
      className = '',
      'aria-label': ariaLabel,
      title,
      placeholder = 'Select…',
    },
    ref,
  ) {
    const items = useMemo(
      () => options.map((o) => ({ value: o.value, label: o.label })),
      [options],
    );

    const triggerPad =
      density === 'compact' ? 'px-2 py-1 text-[11px] tracking-wide' : 'px-2 py-1.5 text-[12px]';
    const iconSize = density === 'compact' ? 12 : 14;

    return (
      <Select.Root
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onValueChange={(next) => {
          const nextValue = next == null ? '' : String(next);
          onValueChange?.(next == null ? null : nextValue);
          onChange?.({ target: { value: nextValue } });
        }}
        items={items}
        disabled={disabled}
        required={required}
        name={name}
        id={id}
        modal={false}
      >
        <div className={['relative block w-full', className].filter(Boolean).join(' ')}>
          <Select.Trigger
            ref={ref}
            className={[
              'flex w-full appearance-none items-center justify-between gap-1.5 rounded-md border bg-muted/40 font-mono outline-none transition-colors',
              'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30',
              invalid ? 'border-destructive' : 'border-border',
              'data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
              triggerPad,
            ].join(' ')}
            aria-label={ariaLabel}
            title={title}
            aria-invalid={invalid || undefined}
            data-invalid={invalid || undefined}
          >
            <Select.Value className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left">
              {(selected) => {
                if (selected == null || selected === '') return placeholder;
                const match = options.find((o) => o.value === selected);
                return match?.label ?? String(selected);
              }}
            </Select.Value>
            <Select.Icon className="shrink-0 text-muted-foreground pointer-events-none">
              <ChevronDown size={iconSize} aria-hidden="true" />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner
              className={OVERLAY_POSITIONER}
              sideOffset={4}
              alignItemWithTrigger={false}
            >
              <Select.Popup className={OVERLAY_POPUP_SELECT} style={chromeBorderStyle}>
                <Select.List>
                  {options.map((option) => (
                    <Select.Item
                      key={option.value}
                      value={option.value}
                      className={OVERLAY_ITEM}
                    >
                      <span className={OVERLAY_ITEM_CHECK} aria-hidden="true">
                        ✓
                      </span>
                      <Select.ItemText className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        {option.label}
                      </Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </div>
      </Select.Root>
    );
  },
);

/** Escape hatch: raw Base UI Select namespace. */
export { Select as BaseSelect };
