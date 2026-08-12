import { fireEvent, render, screen } from '@testing-library/react';
import { Folder, Image } from 'hudsonkit/icons';
import { describe, expect, it, vi } from 'vitest';
import {
  HudCardGrid,
  HudContextPanel,
  HudGroupedList,
  HudPreviewCard,
  HudRail,
  HudTree,
} from 'hudsonkit/patterns';

describe('hudsonkit patterns', () => {
  it('renders grouped lists with selectable rows', () => {
    const onSelect = vi.fn();
    render(
      <HudGroupedList
        groups={[{ id: 'active', title: 'Active', count: 1, items: [{ id: 'a', title: 'Atlas' }] }]}
        itemKey={item => item.id}
        selectedKey="a"
        onSelect={onSelect}
        renderTitle={item => item.title}
      />,
    );

    fireEvent.click(screen.getByText('Atlas'));
    expect(onSelect).toHaveBeenCalledWith({ id: 'a', title: 'Atlas' });
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders a rail with search and status items', () => {
    const onSearch = vi.fn();
    render(
      <HudRail
        title="Assets"
        search={{ value: 'logo', onChange: onSearch }}
        sections={[{
          id: 'library',
          title: 'Library',
          items: [{ id: 'logo', title: 'Logo', subtitle: 'svg', status: 'ready', icon: Image }],
        }]}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'mark' } });
    expect(onSearch).toHaveBeenCalledWith('mark');
    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
  });

  it('supports tree disclosure', () => {
    render(
      <HudTree
        nodes={[{
          id: 'root',
          title: 'Root',
          icon: Folder,
          children: [{ id: 'child', title: 'Child' }],
        }]}
      />,
    );

    expect(screen.queryByText('Child')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Expand'));
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('renders preview cards, card grids, and context panels', () => {
    render(
      <>
        <HudPreviewCard title="Shot 01" subtitle="Opening shot" status="live" />
        <HudCardGrid
          items={[{ id: 'shot-2', title: 'Shot 02' }]}
          itemKey={item => item.id}
          getCardProps={item => ({ title: item.title })}
        />
        <HudContextPanel
          title="Logo"
          rows={[{ label: 'Kind', value: 'SVG' }]}
          sections={[{ id: 'meta', title: 'Metadata', rows: [{ label: 'Size', value: '12 KB' }] }]}
        />
      </>,
    );

    expect(screen.getByText('Shot 01')).toBeInTheDocument();
    expect(screen.getByText('Shot 02')).toBeInTheDocument();
    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('Kind')).toBeInTheDocument();
  });
});
