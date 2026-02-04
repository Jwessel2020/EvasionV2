'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { 
  ArrowLeft,
  Users, 
  MessageSquare, 
  Calendar,
  MapPin,
  CheckCircle,
  Lock,
  Globe,
  EyeOff,
  Star,
  Settings,
  UserPlus,
  Share2,
  Bell,
  BellOff,
  LogOut,
  MoreHorizontal,
  Plus,
  Clock,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupMember {
  userId: {
    _id: string;
    username: string;
    avatar?: string;
  };
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joinedAt: string;
}

interface GroupRule {
  title: string;
  description?: string;
}

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
  createdBy: {
    _id: string;
    username: string;
    avatar?: string;
  };
  rules?: GroupRule[];
  members?: GroupMember[];
  settings?: {
    welcomeMessage?: string;
  };
}

interface Thread {
  _id: string;
  title: string;
  slug: string;
  type: string;
  author: {
    _id: string;
    username: string;
    avatar?: string;
  };
  stats: {
    views: number;
    replies: number;
    likes: number;
  };
  createdAt: string;
  lastReplyAt?: string;
  isPinned?: boolean;
  isLocked?: boolean;
}

const typeIcons = {
  public: Globe,
  private: Lock,
  secret: EyeOff,
};

const roleColors = {
  owner: 'bg-yellow-500/20 text-yellow-400',
  admin: 'bg-red-500/20 text-red-400',
  moderator: 'bg-blue-500/20 text-blue-400',
  member: 'bg-zinc-700 text-zinc-400',
};

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  const [group, setGroup] = useState<Group | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'members' | 'about'>('posts');
  const [isMember, setIsMember] = useState(false);
  const [isNotifying, setIsNotifying] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    async function fetchGroup() {
      try {
        const res = await fetch(`/api/forum/groups/${slug}`);
        const data = await res.json();
        if (data.success) {
          setGroup(data.data);
          // Check if user is a member (would need auth integration)
          setIsMember(false);
        }
      } catch (error) {
        console.error('Error fetching group:', error);
      }
    }

    async function fetchThreads() {
      try {
        const res = await fetch(`/api/forum/threads?groupSlug=${slug}&limit=20`);
        const data = await res.json();
        if (data.success) {
          setThreads(data.data);
        }
      } catch (error) {
        console.error('Error fetching threads:', error);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchGroup();
      fetchThreads();
    }
  }, [slug]);

  const handleJoin = async () => {
    setJoinLoading(true);
    try {
      const res = await fetch(`/api/forum/groups/${slug}/join`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setIsMember(true);
        if (group) {
          setGroup({ ...group, memberCount: group.memberCount + 1 });
        }
      }
    } catch (error) {
      console.error('Error joining group:', error);
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    
    setJoinLoading(true);
    try {
      const res = await fetch(`/api/forum/groups/${slug}/leave`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setIsMember(false);
        if (group) {
          setGroup({ ...group, memberCount: group.memberCount - 1 });
        }
      }
    } catch (error) {
      console.error('Error leaving group:', error);
    } finally {
      setJoinLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-zinc-800" />
        <div className="max-w-5xl mx-auto px-4 -mt-16">
          <div className="flex gap-6">
            <div className="w-32 h-32 rounded-xl bg-zinc-700" />
            <div className="flex-1 pt-20 space-y-3">
              <div className="h-8 bg-zinc-700 rounded w-1/3" />
              <div className="h-4 bg-zinc-700 rounded w-2/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-white mb-2">Group not found</h2>
        <p className="text-zinc-400 mb-4">This group may have been deleted or made private.</p>
        <Link
          href="/forums/groups"
          className="text-red-400 hover:text-red-300"
        >
          Back to Groups
        </Link>
      </div>
    );
  }

  const TypeIcon = typeIcons[group.type];
  const locationStr = [group.location?.city, group.location?.state, group.location?.country]
    .filter(Boolean)
    .join(', ');

  return (
    <div>
      {/* Banner */}
      <div className="h-48 bg-gradient-to-br from-purple-600/30 to-pink-600/30 relative">
        {group.banner && (
          <img
            src={group.banner}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
        
        {/* Back Button */}
        <Link
          href="/forums/groups"
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-lg text-white hover:bg-black/60 transition-colors"
        >
          <ArrowLeft size={16} />
          Groups
        </Link>

        {/* Featured Badge */}
        {group.isFeatured && (
          <div className="absolute top-4 right-4 flex items-center gap-1 bg-yellow-500/20 backdrop-blur-sm text-yellow-400 px-3 py-1.5 rounded-lg text-sm font-medium">
            <Star size={14} fill="currentColor" />
            Featured
          </div>
        )}
      </div>

      {/* Group Header */}
      <div className="max-w-5xl mx-auto px-4 -mt-16 relative z-10">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          {group.avatar ? (
            <img
              src={group.avatar}
              alt={group.name}
              className="w-32 h-32 rounded-xl border-4 border-zinc-900 object-cover shadow-xl"
            />
          ) : (
            <div className="w-32 h-32 rounded-xl border-4 border-zinc-900 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-5xl shadow-xl">
              {group.name[0]}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 pt-4 md:pt-16">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-white">{group.name}</h1>
                  {group.isVerified && (
                    <CheckCircle size={20} className="text-blue-500" fill="currentColor" />
                  )}
                  <span className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                    group.type === 'public' ? 'bg-green-500/20 text-green-400' :
                    group.type === 'private' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-zinc-700 text-zinc-400'
                  )}>
                    <TypeIcon size={12} />
                    {group.type}
                  </span>
                </div>
                
                <p className="text-zinc-400 mb-3">
                  {group.shortDescription || group.description.substring(0, 200)}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {group.memberCount.toLocaleString()} members
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare size={14} />
                    {group.threadCount} posts
                  </span>
                  {locationStr && (
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {locationStr}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    Created {formatDistanceToNow(new Date(group.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {isMember ? (
                  <>
                    <button
                      onClick={() => setIsNotifying(!isNotifying)}
                      className={cn(
                        'p-2 rounded-lg border transition-colors',
                        isNotifying 
                          ? 'bg-zinc-800 border-zinc-700 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                      )}
                      title={isNotifying ? 'Notifications on' : 'Notifications off'}
                    >
                      {isNotifying ? <Bell size={18} /> : <BellOff size={18} />}
                    </button>
                    <button
                      onClick={handleLeave}
                      disabled={joinLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-lg transition-colors"
                    >
                      <LogOut size={16} />
                      Leave
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleJoin}
                    disabled={joinLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    <UserPlus size={16} />
                    {group.type === 'private' ? 'Request to Join' : 'Join Group'}
                  </button>
                )}
                <button className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-colors">
                  <Share2 size={18} />
                </button>
                <button className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-colors">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        {group.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {group.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-6 border-b border-zinc-800">
          {(['posts', 'members', 'about'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-3 text-sm font-medium capitalize transition-colors relative',
                activeTab === tab
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            {/* New Post Button */}
            {isMember && (
              <Link
                href={`/forums/new?group=${group.slug}`}
                className="flex items-center gap-3 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Plus size={20} className="text-zinc-400" />
                </div>
                <span className="text-zinc-400">Start a new discussion...</span>
              </Link>
            )}

            {/* Threads List */}
            {threads.length > 0 ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
                {threads.map((thread) => (
                  <Link
                    key={thread._id}
                    href={`/forums/thread/${thread.slug}`}
                    className="flex items-start gap-4 p-4 hover:bg-zinc-800/50 transition-colors"
                  >
                    {/* Author Avatar */}
                    {thread.author.avatar ? (
                      <img
                        src={thread.author.avatar}
                        alt={thread.author.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {thread.author.username[0]}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {thread.isPinned && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                            Pinned
                          </span>
                        )}
                        {thread.isLocked && (
                          <Lock size={12} className="text-zinc-500" />
                        )}
                        <h3 className="font-medium text-white truncate hover:text-red-400 transition-colors">
                          {thread.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>{thread.author.username}</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-zinc-500">
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
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                <MessageSquare size={48} className="mx-auto text-zinc-700 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No posts yet</h3>
                <p className="text-zinc-400 mb-4">Be the first to start a discussion!</p>
                {isMember && (
                  <Link
                    href={`/forums/new?group=${group.slug}`}
                    className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus size={16} />
                    New Post
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {/* Admins & Moderators */}
            {group.members && group.members.filter(m => m.role !== 'member').length > 0 && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Shield size={14} />
                  Leadership
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.members
                    .filter(m => m.role !== 'member')
                    .map((member) => (
                      <Link
                        key={member.userId._id}
                        href={`/forums/user/${member.userId.username}`}
                        className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        {member.userId.avatar ? (
                          <img
                            src={member.userId.avatar}
                            alt={member.userId.username}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                            {member.userId.username[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-white">{member.userId.username}</p>
                          <span className={cn('text-xs px-2 py-0.5 rounded capitalize', roleColors[member.role])}>
                            {member.role}
                          </span>
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            )}

            {/* All Members Placeholder */}
            <div className="text-center py-12 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <Users size={48} className="mx-auto text-zinc-700 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">{group.memberCount} Members</h3>
              <p className="text-zinc-400">View full member list coming soon</p>
            </div>
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div className="space-y-6">
            {/* Description */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">About</h3>
              <p className="text-zinc-300 whitespace-pre-wrap">{group.description}</p>
            </div>

            {/* Rules */}
            {group.rules && group.rules.length > 0 && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Group Rules</h3>
                <ol className="space-y-3">
                  {group.rules.map((rule, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-sm text-zinc-400">
                        {index + 1}
                      </span>
                      <div>
                        <span className="text-zinc-300">{rule.title}</span>
                        {rule.description && (
                          <p className="text-sm text-zinc-500 mt-1">{rule.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Info */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Details</h3>
              <dl className="space-y-4">
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-500">Category</dt>
                  <dd className="text-white capitalize">{group.category.replace('-', ' ')}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-500">Privacy</dt>
                  <dd className="text-white capitalize flex items-center gap-2">
                    <TypeIcon size={14} />
                    {group.type}
                  </dd>
                </div>
                {locationStr && (
                  <div className="flex items-center justify-between">
                    <dt className="text-zinc-500">Location</dt>
                    <dd className="text-white">{locationStr}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-500">Created</dt>
                  <dd className="text-white">
                    {new Date(group.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-500">Created by</dt>
                  <dd>
                    <Link 
                      href={`/forums/user/${group.createdBy.username}`}
                      className="text-red-400 hover:text-red-300"
                    >
                      @{group.createdBy.username}
                    </Link>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
