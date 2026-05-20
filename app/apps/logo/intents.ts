import type { AppIntent } from 'hudsonkit';

export const logoIntents: AppIntent[] = [
  {
    commandId: 'logo:animate-selected-variant',
    title: 'Animate Selected Logo Variant',
    description: 'Send the selected Logo Designer variant or morph pair to Preframe for animation and rendering.',
    category: 'tool',
    keywords: ['animate', 'motion', 'preframe', 'render', 'logo animation', 'variant morph'],
  },
];
