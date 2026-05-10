// hudsonkit/player — media player primitives.
//
// Shape: Provider + Slots + Hook. Wrap your app in <PlayerProvider> and
// place <PlayerWidget /> wherever you want the chrome to appear (typically
// at the root, alongside <StatusBar>). Read state with usePlayer().
//
// MediaItem is library-owned. Map your app's content types into it on the
// boundary, and use `meta?: unknown` to ride any app-specific payload along.

export type { MediaItem, RepeatMode, StoredQueueItem } from './types/media';
export {
  PlayerProvider,
  usePlayer,
  type PlayerContextValue,
  type PlayerProviderProps,
  type PlayMediaOpts,
  type AttachStageOpts,
  type HistoryItem,
} from './components/player/PlayerProvider';
export {
  PlayerWidget,
  PlayerPanel,
  PlayerStatusBarPill,
  PlayerNowPlaying,
  PlayerVideoStage,
  type PlayerWidgetProps,
  type PlayerPanelProps,
} from './components/player/widget';
