'use client';

import { createElement, useMemo } from 'react';
import type { CommandOption, StatusColor } from 'hudsonkit';
import { useImageProcess } from './ImageProcessProvider';

export function useImageProcessCommands(): CommandOption[] {
  const {
    processedDataUrl,
    processNow,
    loadClipboard,
    resetParams,
    downloadPng,
    downloadGif,
    downloadLottie,
    downloadSpriteSheet,
    downloadEmbed,
    downloadManifest,
  } = useImageProcess();

  return useMemo<CommandOption[]>(() => [
    {
      id: 'image-process-lab:process',
      label: 'Process Image',
      action: () => { void processNow(); },
      shortcut: 'Cmd+Enter',
    },
    {
      id: 'image-process-lab:paste-image',
      label: 'Paste Image from Clipboard',
      action: () => { void loadClipboard(); },
      shortcut: 'Cmd+V',
    },
    {
      id: 'image-process-lab:reset-recipe',
      label: 'Reset Recipe',
      action: resetParams,
    },
    ...(processedDataUrl ? [
      { id: 'image-process-lab:export-png', label: 'Export Processed PNG', action: downloadPng },
      { id: 'image-process-lab:export-gif', label: 'Export Animated GIF', action: () => { void downloadGif(); } },
      { id: 'image-process-lab:export-lottie', label: 'Export Lottie Flipbook JSON', action: () => { void downloadLottie(); } },
      { id: 'image-process-lab:export-sprite', label: 'Export Sprite Sheet', action: () => { void downloadSpriteSheet(); } },
      { id: 'image-process-lab:export-embed', label: 'Export Embed Component', action: () => { void downloadEmbed(); } },
      { id: 'image-process-lab:export-recipe', label: 'Export Recipe JSON', action: downloadManifest },
    ] : []),
  ], [
    downloadEmbed,
    downloadGif,
    downloadLottie,
    downloadManifest,
    downloadPng,
    downloadSpriteSheet,
    loadClipboard,
    processNow,
    processedDataUrl,
    resetParams,
  ]);
}

export function useImageProcessStatus(): { label: string; color: StatusColor } {
  const { status } = useImageProcess();
  if (status === 'error') return { label: 'ERROR', color: 'red' };
  if (status === 'processing') return { label: 'PROCESSING', color: 'amber' };
  if (status === 'done') return { label: 'PNG READY', color: 'emerald' };
  if (status === 'ready') return { label: 'READY', color: 'neutral' };
  return { label: 'EMPTY', color: 'neutral' };
}

export function useImageProcessNavCenter() {
  const { sourceMeta, manifest, program } = useImageProcess();
  const label = manifest
    ? `${manifest.output.width} x ${manifest.output.height}`
    : sourceMeta?.width && sourceMeta.height
      ? `${sourceMeta.width} x ${sourceMeta.height}`
      : program.name;

  return createElement('span', {
    className: 'text-[10px] font-mono text-neutral-500 uppercase tracking-wider',
  }, label);
}

export function useImageProcessLayoutMode(): 'canvas' | 'panel' {
  return 'panel';
}
