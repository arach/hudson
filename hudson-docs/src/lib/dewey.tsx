import {
  Header as DefaultHeader,
  Sidebar as DefaultSidebar,
  AutoTableOfContents as DefaultToc,
  MarkdownContent as DefaultContent,
} from '@arach/dewey'
import type { DeweyProviderProps } from '@arach/dewey'
import Link from 'next/link'
import Image from 'next/image'

// ─── Component Overrides ─────────────────────────────────────
// Swap any component with your own. Run `dewey eject <name>`
// to scaffold a starter override.
export const components = {
  Header: DefaultHeader,
  Sidebar: DefaultSidebar,
  TableOfContents: DefaultToc,
  MarkdownContent: DefaultContent,
}

// ─── Site Config ─────────────────────────────────────────────
export const siteConfig = {
  name: 'hudson-docs',
  defaultPage: 'overview',
  basePath: '/docs',
}

// ─── Provider Config ─────────────────────────────────────────
export const providerProps: Omit<DeweyProviderProps, 'children'> = {
  theme: 'ocean',
  components: { Link, Image },
}
