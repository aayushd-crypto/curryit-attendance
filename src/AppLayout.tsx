import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MiniSidebar } from './MiniSidebar'
import { Navbar } from './Navbar'

export function AppLayout() {
  // Mobile-only drawer — desktop uses hover-expand MiniSidebar
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden app-bg">
      {/* Desktop: always-visible hover-expand sidebar */}
      <MiniSidebar />

      {/* Mobile: slide-out drawer (sm:hidden equivalent — only renders overlay on mobile) */}
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content — offset by collapsed sidebar width (60px) on desktop */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden sm:ml-[60px]">
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-4 pb-8 sm:p-5 sm:pb-5 lg:p-6">
          <div className="animate-fadeUp">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
