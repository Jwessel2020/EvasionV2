'use client';

import { ReactNode, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Home,
  MessageSquare,
  Users,
  Compass,
  Bell,
  Search,
  Plus,
  Menu,
  X,
  TrendingUp,
  Clock,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ForumsLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/forums', label: 'Home', icon: Home },
  { href: '/forums/boards', label: 'Boards', icon: MessageSquare },
  { href: '/forums/groups', label: 'Groups', icon: Users },
  { href: '/forums/explore', label: 'Explore', icon: Compass },
];

const quickFilters = [
  { href: '/forums?sort=hot', label: 'Trending', icon: TrendingUp },
  { href: '/forums?sort=newest', label: 'New', icon: Clock },
  { href: '/forums?sort=top', label: 'Top', icon: Star },
];

function ForumsLayoutContent({ children }: ForumsLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
        <div className="flex h-14 items-center gap-4 px-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 text-zinc-400 hover:text-white"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Logo/Title */}
          <Link href="/forums" className="flex items-center gap-2 font-bold text-white">
            <MessageSquare className="h-5 w-5 text-red-500" />
            <span className="hidden sm:inline">Forums</span>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search threads, groups, users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="p-2 text-zinc-400 hover:text-white relative">
              <Bell size={20} />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
            </button>
            <Link
              href="/forums/new"
              className="hidden sm:flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              New Post
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-64 bg-zinc-950 border-r border-zinc-800 pt-14 transition-transform lg:translate-x-0 lg:static lg:z-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <nav className="flex flex-col h-full p-4 space-y-1">
            {/* Main Navigation */}
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/forums' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-red-600/20 text-red-500'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  )}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              );
            })}

            <div className="h-px bg-zinc-800 my-4" />

            {/* Quick Filters */}
            <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Quick Filters
            </p>
            {quickFilters.map((item) => {
              const sortValue = item.href.split('sort=')[1]?.split('&')[0];
              const isActive = pathname === '/forums' && currentSort === sortValue;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive 
                      ? 'text-red-400 bg-red-500/10'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  )}
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              );
            })}

            <div className="h-px bg-zinc-800 my-4" />

            {/* Your Groups (placeholder) */}
            <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Your Groups
            </p>
            <p className="px-3 text-sm text-zinc-600">
              Join groups to see them here
            </p>

            {/* Mobile New Post Button */}
            <div className="mt-auto pt-4 lg:hidden">
              <Link
                href="/forums/new"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                New Post
              </Link>
            </div>
          </nav>
        </aside>

        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function ForumsLayout({ children }: ForumsLayoutProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <ForumsLayoutContent>{children}</ForumsLayoutContent>
    </Suspense>
  );
}
