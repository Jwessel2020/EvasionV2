'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  MapPin, 
  Link as LinkIcon, 
  Calendar,
  MessageSquare,
  Heart,
  Users,
  Car,
  Trophy,
  Settings,
  UserPlus,
  Check,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Vehicle {
  _id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  nickname?: string;
  photos: string[];
  isPrimary: boolean;
}

interface ForumUser {
  _id: string;
  username: string;
  displayName: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  location?: string;
  website?: string;
  garage: Vehicle[];
  reputation: number;
  postCount: number;
  threadCount: number;
  followerCount: number;
  followingCount: number;
  role: string;
  createdAt: string;
  lastActiveAt: string;
}

interface Thread {
  _id: string;
  title: string;
  slug: string;
  type: string;
  replyCount: number;
  likeCount: number;
  createdAt: string;
  board?: {
    name: string;
    slug: string;
    color: string;
  };
}

type Tab = 'posts' | 'threads' | 'garage' | 'about';

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      {vehicle.photos.length > 0 ? (
        <img
          src={vehicle.photos[0]}
          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-zinc-800 flex items-center justify-center">
          <Car size={48} className="text-zinc-700" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-white">
            {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          </h3>
          {vehicle.isPrimary && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
              Primary
            </span>
          )}
        </div>
        {vehicle.nickname && (
          <p className="text-sm text-zinc-400">
            {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}
          </p>
        )}
      </div>
    </div>
  );
}

function ThreadRow({ thread }: { thread: Thread }) {
  return (
    <Link
      href={`/forums/thread/${thread.slug}`}
      className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50 -mx-2 px-2 rounded"
    >
      <div>
        <h4 className="font-medium text-white hover:text-red-400 line-clamp-1">
          {thread.title}
        </h4>
        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
          {thread.board && (
            <span style={{ color: thread.board.color }}>{thread.board.name}</span>
          )}
          <span>{formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-zinc-500">
        <span className="flex items-center gap-1">
          <MessageSquare size={14} />
          {thread.replyCount}
        </span>
        <span className="flex items-center gap-1">
          <Heart size={14} />
          {thread.likeCount}
        </span>
      </div>
    </Link>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  
  const [user, setUser] = useState<ForumUser | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      try {
        // Fetch user by username
        const res = await fetch(`/api/forum/users?search=${username}&limit=1`);
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
          setUser(data.data[0]);
          
          // Fetch user's threads
          const threadsRes = await fetch(`/api/forum/threads?author=${data.data[0]._id}&limit=10`);
          const threadsData = await threadsRes.json();
          if (threadsData.success) {
            setThreads(threadsData.data);
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchUser();
  }, [username]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-zinc-800" />
        <div className="max-w-4xl mx-auto px-4 -mt-16">
          <div className="flex items-end gap-4 mb-6">
            <div className="w-32 h-32 rounded-xl bg-zinc-700" />
            <div className="flex-1 pb-4">
              <div className="h-8 bg-zinc-700 rounded w-48 mb-2" />
              <div className="h-4 bg-zinc-700 rounded w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold text-white mb-2">User not found</h1>
        <p className="text-zinc-400 mb-4">This user may not exist or has been removed.</p>
        <Link href="/forums" className="text-red-500 hover:text-red-400">
          Back to Forums
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'posts', label: 'Posts' },
    { id: 'threads', label: 'Threads' },
    { id: 'garage', label: 'Garage' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div>
      {/* Banner */}
      <div className="h-48 bg-gradient-to-br from-violet-600/30 to-purple-600/30 relative">
        {user.banner && (
          <img
            src={user.banner}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Profile Header */}
      <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
          {/* Avatar */}
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.username}
              className="w-32 h-32 rounded-xl border-4 border-zinc-950 object-cover"
            />
          ) : (
            <div className="w-32 h-32 rounded-xl border-4 border-zinc-950 bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-bold text-4xl">
              {user.username[0].toUpperCase()}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white">{user.displayName}</h1>
              {user.role !== 'member' && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  user.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                )}>
                  {user.role}
                </span>
              )}
            </div>
            <p className="text-zinc-400">@{user.username}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsFollowing(!isFollowing)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                isFollowing
                  ? 'bg-zinc-800 text-white hover:bg-zinc-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              )}
            >
              {isFollowing ? (
                <>
                  <Check size={16} />
                  Following
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Follow
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-6 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" />
            <span className="text-white font-semibold">{user.reputation}</span>
            <span className="text-zinc-500">reputation</span>
          </div>
          <div>
            <span className="text-white font-semibold">{user.threadCount}</span>
            <span className="text-zinc-500 ml-1">threads</span>
          </div>
          <div>
            <span className="text-white font-semibold">{user.postCount}</span>
            <span className="text-zinc-500 ml-1">posts</span>
          </div>
          <div>
            <span className="text-white font-semibold">{user.followerCount}</span>
            <span className="text-zinc-500 ml-1">followers</span>
          </div>
          <div>
            <span className="text-white font-semibold">{user.followingCount}</span>
            <span className="text-zinc-500 ml-1">following</span>
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="text-zinc-300 mb-4">{user.bio}</p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap gap-4 text-sm text-zinc-500 mb-6">
          {user.location && (
            <span className="flex items-center gap-1">
              <MapPin size={14} />
              {user.location}
            </span>
          )}
          {user.website && (
            <a
              href={user.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-red-400 hover:text-red-300"
            >
              <LinkIcon size={14} />
              {user.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            Joined {format(new Date(user.createdAt), 'MMMM yyyy')}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-red-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'posts' && (
          <div className="space-y-1">
            {threads.length > 0 ? (
              threads.map((thread) => (
                <ThreadRow key={thread._id} thread={thread} />
              ))
            ) : (
              <p className="text-center py-8 text-zinc-500">No posts yet</p>
            )}
          </div>
        )}

        {activeTab === 'threads' && (
          <div className="space-y-1">
            {threads.length > 0 ? (
              threads.map((thread) => (
                <ThreadRow key={thread._id} thread={thread} />
              ))
            ) : (
              <p className="text-center py-8 text-zinc-500">No threads yet</p>
            )}
          </div>
        )}

        {activeTab === 'garage' && (
          <div>
            {user.garage.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {user.garage.map((vehicle) => (
                  <VehicleCard key={vehicle._id} vehicle={vehicle} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Car size={48} className="mx-auto text-zinc-700 mb-4" />
                <p className="text-zinc-500">No vehicles in garage yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h3 className="font-semibold text-white mb-4">About {user.displayName}</h3>
              <div className="space-y-4 text-sm">
                {user.bio && (
                  <div>
                    <span className="text-zinc-500">Bio</span>
                    <p className="text-zinc-300 mt-1">{user.bio}</p>
                  </div>
                )}
                {user.location && (
                  <div>
                    <span className="text-zinc-500">Location</span>
                    <p className="text-zinc-300 mt-1">{user.location}</p>
                  </div>
                )}
                <div>
                  <span className="text-zinc-500">Member since</span>
                  <p className="text-zinc-300 mt-1">
                    {format(new Date(user.createdAt), 'MMMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Last active</span>
                  <p className="text-zinc-300 mt-1">
                    {formatDistanceToNow(new Date(user.lastActiveAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
