'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks';
import { Button } from '@/components/ui';
import {
  Map,
  Route,
  Calendar,
  MessageSquare,
  Warehouse,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  BarChart3,
  Zap,
  Camera,
} from 'lucide-react';

const navigation = [
  { name: 'Map', href: '/map', icon: Map },
  { name: 'Spotting', href: '/spotting', icon: Camera },
  { name: 'Routes', href: '/routes', icon: Route },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Insights', href: '/insights', icon: Zap },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'Forums', href: '/forums', icon: MessageSquare },
  { name: 'Garage', href: '/garage', icon: Warehouse },
  { name: 'Profile', href: '/profile', icon: User },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800">
            <Link href="/dashboard" className="flex items-center gap-2">
              <img
                src="/images/evasion-logo.png"
                alt="Evasion"
                className="h-8 w-auto"
              />
            </Link>
            <button
              className="lg:hidden text-zinc-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-violet-500/10 text-violet-500'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  )}
                >
                  <item.icon size={20} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                <span className="text-violet-500 font-medium">
                  {user?.displayName?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.displayName || 'User'}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  @{user?.username || 'username'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Link href="/settings" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <Settings size={16} className="mr-2" />
                  Settings
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <LogOut size={16} />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
          <div className="flex items-center justify-between h-full px-4">
            <button
              className="lg:hidden text-zinc-400 hover:text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>

            <div className="flex-1 lg:flex-none" />

            <div className="flex items-center gap-3">
              <button className="relative p-2 text-zinc-400 hover:text-white transition-colors">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-violet-500 rounded-full" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
