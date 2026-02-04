'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  MessageSquare, 
  Users, 
  Eye, 
  Heart, 
  Clock, 
  ChevronRight,
  Flame,
  Car,
  Wrench,
  ShoppingBag,
  Calendar,
  HelpCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Thread {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  type: string;
  author: {
    username: string;
    displayName: string;
    avatar?: string;
  };
  board?: {
    name: string;
    slug: string;
    color: string;
  };
  group?: {
    name: string;
    slug: string;
  };
  viewCount: number;
  replyCount: number;
  likeCount: number;
  createdAt: string;
  lastReplyAt?: string;
  lastReplyUsername?: string;
  images?: { url: string }[];
  tags: string[];
}

interface Board {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  color: string;
  threadCount: number;
  postCount: number;
}

interface Group {
  _id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  avatar?: string;
  memberCount: number;
  category: string;
}

const threadTypeIcons: Record<string, typeof MessageSquare> = {
  discussion: MessageSquare,
  question: HelpCircle,
  showcase: Car,
  'build-log': Wrench,
  'for-sale': ShoppingBag,
  event: Calendar,
  poll: MessageSquare,
};

function ThreadCard({ thread }: { thread: Thread }) {
  const TypeIcon = threadTypeIcons[thread.type] || MessageSquare;
  const hasImage = thread.images && thread.images.length > 0;

  return (
    <Link
      href={`/forums/thread/${thread.slug}`}
      className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
    >
      <div className="flex gap-4">
        {/* Author Avatar */}
        <div className="flex-shrink-0">
          {thread.author.avatar ? (
            <img
              src={thread.author.avatar}
              alt={thread.author.username}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 font-medium">
              {thread.author.username[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            {thread.board && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${thread.board.color}20`, color: thread.board.color }}
              >
                {thread.board.name}
              </span>
            )}
            {thread.group && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                {thread.group.name}
              </span>
            )}
            <TypeIcon size={14} className="text-zinc-500" />
          </div>

          {/* Title */}
          <h3 className="font-semibold text-white mb-1 line-clamp-1">{thread.title}</h3>

          {/* Excerpt */}
          {thread.excerpt && (
            <p className="text-sm text-zinc-400 line-clamp-2 mb-2">{thread.excerpt}</p>
          )}

          {/* Tags */}
          {thread.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {thread.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>{thread.author.username}</span>
            <span className="flex items-center gap-1">
              <Eye size={12} />
              {thread.viewCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare size={12} />
              {thread.replyCount}
            </span>
            <span className="flex items-center gap-1">
              <Heart size={12} />
              {thread.likeCount}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Thumbnail */}
        {hasImage && (
          <div className="flex-shrink-0 hidden sm:block">
            <img
              src={thread.images![0].url}
              alt=""
              className="w-20 h-20 rounded-lg object-cover"
            />
          </div>
        )}
      </div>
    </Link>
  );
}

function BoardCard({ board }: { board: Board }) {
  return (
    <Link
      href={`/forums/boards/${board.slug}`}
      className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
          style={{ backgroundColor: `${board.color}20`, color: board.color }}
        >
          {board.icon || <MessageSquare size={20} />}
        </div>
        <div>
          <h3 className="font-semibold text-white">{board.name}</h3>
          <p className="text-xs text-zinc-500">
            {board.threadCount} threads · {board.postCount} posts
          </p>
        </div>
      </div>
      <p className="text-sm text-zinc-400 line-clamp-2">{board.description}</p>
    </Link>
  );
}

function GroupCard({ group }: { group: Group }) {
  return (
    <Link
      href={`/forums/groups/${group.slug}`}
      className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
    >
      <div className="flex items-center gap-3 mb-2">
        {group.avatar ? (
          <img src={group.avatar} alt={group.name} className="w-12 h-12 rounded-full" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
            {group.name[0]}
          </div>
        )}
        <div>
          <h3 className="font-semibold text-white">{group.name}</h3>
          <p className="text-xs text-zinc-500">
            <Users size={12} className="inline mr-1" />
            {group.memberCount} members
          </p>
        </div>
      </div>
      {group.shortDescription && (
        <p className="text-sm text-zinc-400 line-clamp-2">{group.shortDescription}</p>
      )}
    </Link>
  );
}

export default function CommunityHomePage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [threadsRes, boardsRes, groupsRes] = await Promise.all([
          fetch('/api/forum/threads?sort=hot&limit=10'),
          fetch('/api/forum/boards?type=board&limit=6'),
          fetch('/api/forum/groups?featured=true&limit=4'),
        ]);

        const [threadsData, boardsData, groupsData] = await Promise.all([
          threadsRes.json(),
          boardsRes.json(),
          groupsRes.json(),
        ]);

        if (threadsData.success) setThreads(threadsData.data);
        if (boardsData.success) setBoards(boardsData.data);
        if (groupsData.success) setGroups(groupsData.data);
      } catch (error) {
        console.error('Error fetching community data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-1/4" />
          <div className="h-32 bg-zinc-800 rounded" />
          <div className="h-32 bg-zinc-800 rounded" />
          <div className="h-32 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white mb-2">
          Welcome to the Evasion Forums
        </h1>
        <p className="text-zinc-300">
          Connect with fellow automotive enthusiasts. Share builds, ask questions, find local meets, and more.
        </p>
      </div>

      {/* Popular Boards */}
      {boards.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <MessageSquare size={20} className="text-red-500" />
              Popular Boards
            </h2>
            <Link
              href="/forums/boards"
              className="text-sm text-red-500 hover:text-red-400 flex items-center gap-1"
            >
              View All <ChevronRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <BoardCard key={board._id} board={board} />
            ))}
          </div>
        </section>
      )}

      {/* Featured Groups */}
      {groups.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users size={20} className="text-purple-500" />
              Featured Groups
            </h2>
            <Link
              href="/forums/groups"
              className="text-sm text-purple-500 hover:text-purple-400 flex items-center gap-1"
            >
              View All <ChevronRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {groups.map((group) => (
              <GroupCard key={group._id} group={group} />
            ))}
          </div>
        </section>
      )}

      {/* Trending Threads */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Flame size={20} className="text-orange-500" />
            Trending Discussions
          </h2>
        </div>
        {threads.length > 0 ? (
          <div className="space-y-3">
            {threads.map((thread) => (
              <ThreadCard key={thread._id} thread={thread} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <MessageSquare size={48} className="mx-auto text-zinc-700 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No threads yet</h3>
            <p className="text-zinc-400 mb-4">Be the first to start a discussion!</p>
            <Link
              href="/forums/new"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Create Post
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
