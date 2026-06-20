import { useState } from 'react'
import { useTheme } from './useTheme'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MiniSidebar } from './MiniSidebar'
import { Navbar } from './Navbar'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { dark } = useTheme()
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: dark ? '#0f172a' : '#F0F2F7' }}>
      {/* Always-visible icon rail */}
      <MiniSidebar onMenuClick={() => setSidebarOpen(true)} />

      {/* Full slide-in sidebar (overlay) */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content — offset by mini rail on sm+ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden sm:ml-14">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-5 sm:p-6 lg:p-7">
          <div className="animate-fadeUp">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
