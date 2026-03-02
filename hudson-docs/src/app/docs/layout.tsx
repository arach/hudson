'use client'

import { usePathname } from 'next/navigation'
import { components, siteConfig } from '@/lib/dewey'
import { getNavTree } from '@/lib/navigation'

const { Header, Sidebar } = components

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const tree = getNavTree()
  const currentPage = pathname.replace(/^\/docs\//, '').replace(/\/$/, '') || siteConfig.defaultPage

  return (
    <>
      <Header
        projectName={siteConfig.name}
        homeUrl={siteConfig.basePath}
        showThemeToggle
      />
      <div className="docs-layout">
        <aside className="docs-sidebar">
          <div className="docs-sidebar-sticky">
            <Sidebar
              tree={tree}
              currentPage={currentPage}
              projectName={siteConfig.name}
              basePath={siteConfig.basePath}
            />
          </div>
        </aside>
        <main className="docs-main">
          {children}
        </main>
      </div>
    </>
  )
}
