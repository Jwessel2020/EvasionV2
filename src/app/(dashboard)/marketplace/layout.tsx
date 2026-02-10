'use client';

import { ReactNode, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Store,
  ShoppingBag,
  Tag,
  Heart,
  MessageSquare,
  Package,
  Plus,
  Search,
  Menu,
  X,
  TrendingUp,
  Sparkles,
  Wrench,
  Car,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketplaceLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/marketplace', label: 'Browse', icon: ShoppingBag },
  { href: '/marketplace/shops', label: 'Shops', icon: Store },
  { href: '/marketplace/saved', label: 'Saved', icon: Heart },
  { href: '/marketplace/messages', label: 'Messages', icon: MessageSquare },
  { href: '/marketplace/my-listings', label: 'My Listings', icon: Tag },
  { href: '/marketplace/orders', label: 'Orders', icon: Package },
];

const categories = [
  { href: '/marketplace?category=parts', label: 'Parts', icon: Wrench },
  { href: '/marketplace?category=accessories', label: 'Accessories', icon: Sparkles },
  { href: '/marketplace?category=wheels-tires', label: 'Wheels & Tires', icon: Car },
  { href: '/marketplace?category=electronics', label: 'Electronics', icon: TrendingUp },
  { href: '/marketplace?category=vehicles', label: 'Vehicles', icon: Car },
];

function MarketplaceLayoutContent({ children }: MarketplaceLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('category');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/marketplace?search=${encodeURIComponent(searchQuery)}`;
    }
  };

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
          <Link href="/marketplace" className="flex items-center gap-2 font-bold text-white">
            <Store className="h-5 w-5 text-red-500" />
            <span className="hidden sm:inline">Marketplace</span>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search parts, accessories, vehicles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/marketplace/create"
              className="hidden sm:flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Sell Item
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
          <nav className="flex flex-col h-full p-4 space-y-1 overflow-y-auto">
            {/* Main Navigation */}
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/marketplace' && pathname.startsWith(item.href));
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

            {/* Categories */}
            <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Categories
            </p>
            {categories.map((item) => {
              const categoryValue = item.href.split('category=')[1];
              const isActive = pathname === '/marketplace' && currentCategory === categoryValue;
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

            {/* Partner Shops */}
            <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Partner Shops
            </p>
            <Link
              href="/marketplace/shops"
              onClick={() => setSidebarOpen(false)}
              className="text-sm text-zinc-400 hover:text-white px-3 py-2"
            >
              Browse all shops →
            </Link>

            {/* Mobile Sell Button */}
            <div className="mt-auto pt-4 lg:hidden">
              <Link
                href="/marketplace/create"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Sell Item
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

export default function MarketplaceLayout({ children }: MarketplaceLayoutProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <MarketplaceLayoutContent>{children}</MarketplaceLayoutContent>
    </Suspense>
  );
}
