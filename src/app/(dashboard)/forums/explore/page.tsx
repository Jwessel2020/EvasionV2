'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Search,
  TrendingUp,
  Users,
  MessageSquare,
  Star,
  MapPin,
  Clock,
  Flame,
  Award,
  Zap,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Thread {
  _id: string;
  title: string;
  slug: string;
  type: string;
  author: {
    username: string;
    avatar?: string;
  };
  board?: {
    name: string;
    slug: string;
  };
  group?: {
    name: string;
    slug: string;
  };
  stats: {
    views: number;
    replies: number;
    likes: number;
  };
  createdAt: string;
}

interface Group {
  _id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  avatar?: string;
  memberCount: number;
  category: string;
  isVerified: boolean;
}

interface User {
  _id: string;
  username: string;
  avatar?: string;
  bio?: string;
  reputation: number;
  threadCount: number;
}

const trendingTags = [
  'jdm', 'stance', 'turbo', 'drift', 'track', 'build', 
  'swap', 'restoration', 'euro', 'muscle', 'offroad', 'electric'
];

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState<'threads' | 'groups' | 'users'>('threads');
  const [trendingThreads, setTrendingThreads] = useState<Thread[]>([]);
  const [featuredGroups, setFeaturedGroups] = useState<Group[]>([]);
  const [topUsers, setTopUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [threadsRes, groupsRes, usersRes] = await Promise.all([
          fetch('/api/forum/threads?sort=hot&limit=10'),
          fetch('/api/forum/groups?featured=true&limit=6'),
          fetch('/api/forum/users?sort=reputation&limit=10'),
        ]);

        const [threadsData, groupsData, usersData] = await Promise.all([
          threadsRes.json(),
          groupsRes.json(),
          usersRes.json(),
        ]);

        if (threadsData.success) setTrendingThreads(threadsData.data);
        if (groupsData.success) setFeaturedGroups(groupsData.data);
        if (usersData.success) setTopUsers(usersData.data);
      } catch (error) {
        console.error('Error fetching explore data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/forums?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Explore</h1>
        <p className="text-zinc-400">Discover new discussions, groups, and people</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the forums..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
      </form>

      {/* Trending Tags */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Hash size={20} className="text-red-500" />
          Trending Tags
        </h2>
        <div className="flex flex-wrap gap-2">
          {trendingTags.map((tag) => (
            <Link
              key={tag}
              href={`/forums?tag=${tag}`}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-full text-sm transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {[
          { id: 'threads', label: 'Hot Threads', icon: Flame },
          { id: 'groups', label: 'Featured Groups', icon: Users },
          { id: 'users', label: 'Top Members', icon: Award },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative',
              activeTab === tab.id
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <div className="h-5 bg-zinc-800 rounded w-3/4 mb-2" />
              <div className="h-4 bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Hot Threads */}
          {activeTab === 'threads' && (
            <div className="space-y-3">
              {trendingThreads.length > 0 ? (
                trendingThreads.map((thread, index) => (
                  <Link
                    key={thread._id}
                    href={`/forums/thread/${thread.slug}`}
                    className="flex items-start gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
                  >
                    {/* Rank */}
                    <div className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      index === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                      index === 2 ? 'bg-amber-600/20 text-amber-500' :
                      'bg-zinc-800 text-zinc-500'
                    )}>
                      {index + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate hover:text-red-400 transition-colors">
                        {thread.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                        <span>by {thread.author.username}</span>
                        {thread.board && (
                          <span className="text-red-400">{thread.board.name}</span>
                        )}
                        {thread.group && (
                          <span className="text-purple-400">{thread.group.name}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-zinc-500">
                      <span className="flex items-center gap-1">
                        <MessageSquare size={14} />
                        {thread.stats.replies}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp size={14} />
                        {thread.stats.views}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  No trending threads yet. Be the first to start a discussion!
                </div>
              )}
            </div>
          )}

          {/* Featured Groups */}
          {activeTab === 'groups' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredGroups.length > 0 ? (
                featuredGroups.map((group) => (
                  <Link
                    key={group._id}
                    href={`/forums/groups/${group.slug}`}
                    className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {group.avatar ? (
                        <img
                          src={group.avatar}
                          alt={group.name}
                          className="w-12 h-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                          {group.name[0]}
                        </div>
                      )}
                      <div>
                        <h3 className="font-medium text-white flex items-center gap-1">
                          {group.name}
                          {group.isVerified && (
                            <Star size={14} className="text-yellow-500" fill="currentColor" />
                          )}
                        </h3>
                        <span className="text-xs text-zinc-500 capitalize">
                          {group.category.replace('-', ' ')}
                        </span>
                      </div>
                    </div>
                    {group.shortDescription && (
                      <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
                        {group.shortDescription}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <Users size={14} />
                      {group.memberCount.toLocaleString()} members
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-zinc-500">
                  No featured groups yet.
                </div>
              )}
            </div>
          )}

          {/* Top Members */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              {topUsers.length > 0 ? (
                topUsers.map((user, index) => (
                  <Link
                    key={user._id}
                    href={`/forums/user/${user.username}`}
                    className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
                  >
                    {/* Rank */}
                    <div className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      index === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                      index === 2 ? 'bg-amber-600/20 text-amber-500' :
                      'bg-zinc-800 text-zinc-500'
                    )}>
                      {index + 1}
                    </div>

                    {/* Avatar */}
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                        {user.username[0]}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1">
                      <h3 className="font-medium text-white">{user.username}</h3>
                      {user.bio && (
                        <p className="text-sm text-zinc-400 line-clamp-1">{user.bio}</p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-white">{user.reputation.toLocaleString()}</div>
                        <div className="text-xs text-zinc-500">rep</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-white">{user.threadCount}</div>
                        <div className="text-xs text-zinc-500">posts</div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  No members yet.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/forums/boards"
          className="flex items-center gap-4 p-6 bg-gradient-to-br from-red-600/20 to-red-600/5 border border-red-500/20 rounded-xl hover:border-red-500/40 transition-colors"
        >
          <MessageSquare size={32} className="text-red-500" />
          <div>
            <h3 className="font-semibold text-white">Browse Boards</h3>
            <p className="text-sm text-zinc-400">Topic-based discussions</p>
          </div>
        </Link>

        <Link
          href="/forums/groups"
          className="flex items-center gap-4 p-6 bg-gradient-to-br from-purple-600/20 to-purple-600/5 border border-purple-500/20 rounded-xl hover:border-purple-500/40 transition-colors"
        >
          <Users size={32} className="text-purple-500" />
          <div>
            <h3 className="font-semibold text-white">Join Groups</h3>
            <p className="text-sm text-zinc-400">Find your community</p>
          </div>
        </Link>

        <Link
          href="/forums/new"
          className="flex items-center gap-4 p-6 bg-gradient-to-br from-green-600/20 to-green-600/5 border border-green-500/20 rounded-xl hover:border-green-500/40 transition-colors"
        >
          <Zap size={32} className="text-green-500" />
          <div>
            <h3 className="font-semibold text-white">Start a Thread</h3>
            <p className="text-sm text-zinc-400">Share your thoughts</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
