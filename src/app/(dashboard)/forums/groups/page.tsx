'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Users, 
  Plus, 
  Search, 
  MapPin, 
  MessageSquare,
  CheckCircle,
  Star,
  Lock,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Group {
  _id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  avatar?: string;
  banner?: string;
  type: 'public' | 'private' | 'secret';
  category: string;
  tags: string[];
  memberCount: number;
  threadCount: number;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  isVerified: boolean;
  isFeatured: boolean;
  createdAt: string;
}

const categories = [
  { id: 'all', label: 'All Groups' },
  { id: 'car-club', label: 'Car Clubs' },
  { id: 'brand', label: 'Brand Specific' },
  { id: 'regional', label: 'Regional' },
  { id: 'racing', label: 'Racing' },
  { id: 'diy', label: 'DIY & Tech' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'events', label: 'Events' },
  { id: 'other', label: 'Other' },
];

const sortOptions = [
  { id: 'popular', label: 'Most Popular' },
  { id: 'active', label: 'Most Active' },
  { id: 'newest', label: 'Newest' },
  { id: 'alphabetical', label: 'A-Z' },
];

function GroupCard({ group }: { group: Group }) {
  const locationStr = [group.location?.city, group.location?.state, group.location?.country]
    .filter(Boolean)
    .join(', ');

  return (
    <Link
      href={`/forums/groups/${group.slug}`}
      className="block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors group"
    >
      {/* Banner */}
      <div className="h-24 bg-gradient-to-br from-purple-600/30 to-pink-600/30 relative">
        {group.banner && (
          <img
            src={group.banner}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
        {group.isFeatured && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-xs font-medium">
            <Star size={12} fill="currentColor" />
            Featured
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="px-4 -mt-8 relative z-10">
        {group.avatar ? (
          <img
            src={group.avatar}
            alt={group.name}
            className="w-16 h-16 rounded-xl border-4 border-zinc-900 object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl border-4 border-zinc-900 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl">
            {group.name[0]}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 pt-2">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-white group-hover:text-red-400 transition-colors">
            {group.name}
          </h3>
          {group.isVerified && (
            <CheckCircle size={14} className="text-blue-500" fill="currentColor" />
          )}
          {group.type === 'private' && (
            <Lock size={14} className="text-zinc-500" />
          )}
        </div>

        <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
          {group.shortDescription || group.description}
        </p>

        {/* Location */}
        {locationStr && (
          <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
            <MapPin size={12} />
            {locationStr}
          </p>
        )}

        {/* Tags */}
        {group.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {group.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-zinc-500 pt-3 border-t border-zinc-800">
          <span className="flex items-center gap-1">
            <Users size={12} />
            {group.memberCount.toLocaleString()} members
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare size={12} />
            {group.threadCount} posts
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function GroupsPage() {
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [sort, setSort] = useState(searchParams.get('sort') || 'popular');

  useEffect(() => {
    async function fetchGroups() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category !== 'all') params.set('category', category);
        if (sort) params.set('sort', sort);
        if (search) params.set('search', search);

        const res = await fetch(`/api/forum/groups?${params}`);
        const data = await res.json();
        if (data.success) {
          setGroups(data.data);
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(fetchGroups, search ? 300 : 0);
    return () => clearTimeout(debounce);
  }, [category, sort, search]);

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Groups</h1>
          <p className="text-zinc-400">Find your community of car enthusiasts</p>
        </div>
        <Link
          href="/forums/groups/create"
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Create Group
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          {sortOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 lg:mx-0 lg:px-0">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              category === cat.id
                ? 'bg-red-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-zinc-800 rounded-t-xl" />
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-b-xl p-4 space-y-3">
                <div className="h-6 bg-zinc-800 rounded w-2/3" />
                <div className="h-4 bg-zinc-800 rounded w-full" />
                <div className="h-4 bg-zinc-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <GroupCard key={group._id} group={group} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-zinc-900/50 border border-zinc-800 rounded-xl">
          <Users size={48} className="mx-auto text-zinc-700 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No groups found</h3>
          <p className="text-zinc-400 mb-4">
            {search
              ? 'Try adjusting your search or filters'
              : 'Be the first to create a group!'}
          </p>
          <Link
            href="/forums/groups/create"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Create Group
          </Link>
        </div>
      )}
    </div>
  );
}
