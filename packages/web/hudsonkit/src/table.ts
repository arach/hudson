// hudsonkit/table — tabular data primitive + resizable-column hook.

export {
  HudTable,
  type HudTableProps,
  type HudTableColumn,
  type HudTableAlignment,
  type HudTableDensity,
  type HudTableSortDescriptor,
  type HudTableSortDirection,
  type HudTableSortValue,
} from './components/HudTable';

export {
  useResizableColumns,
  type ResizableColumnSpec,
  type UseResizableColumnsOptions,
} from './hooks/useResizableColumns';
