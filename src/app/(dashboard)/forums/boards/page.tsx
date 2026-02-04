'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, Users, Clock, Plus, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Board {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  color: string;
  type: 'category' | 'board' | 'user-created';
  threadCount: number;
  postCount: number;
  lastPostAt?: string;
  lastPostBy?: {
    username: string;
    avatar?: string;
  };
  lastThreadTitle?: string;
  subBoards?: {
    name: string;
    slug: string;
    threadCount: number;
  }[];
}

function BoardRow({ board }: { board: Board }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <Link
        href={`/forums/boards/${board.slug}`}
        className="flex items-center gap-4 p-4 hover:bg-zinc-800/50 transition-colors"
      >
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: `${board.color}20`, color: board.color }}
        >
          {board.icon || <MessageSquare size={24} />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">{board.name}</h3>
            {board.type === 'user-created' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                Community
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400 line-clamp-1">{board.description}</p>
          
          {/* Sub-boards */}
          {board.subBoards && board.subBoards.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {board.subBoards.slice(0, 4).map((sub) => (
                <Link
                  key={sub.slug}
                  href={`/forums/boards/${sub.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {sub.name}
                </Link>
              ))}
              {board.subBoards.length > 4 && (
                <span className="text-xs text-zinc-600">
                  +{board.subBoards.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-6 text-sm text-zinc-500">
          <div className="text-center">
            <div className="font-semibold text-white">{board.threadCount}</div>
            <div className="text-xs">Threads</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-white">{board.postCount}</div>
            <div className="text-xs">Posts</div>
          </div>
        </div>

        {/* Last Activity */}
        <div className="hidden md:block w-48 text-right">
          {board.lastPostAt ? (
            <>
              <p className="text-sm text-zinc-400 line-clamp-1">{board.lastThreadTitle}</p>
              <p className="text-xs text-zinc-500">
                {board.lastPostBy?.username} ·{' '}
                {formatDistanceToNow(new Date(board.lastPostAt), { addSuffix: true })}
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-600">No posts yet</p>
          )}
        </div>

        <ChevronRight size={20} className="text-zinc-600 flex-shrink-0" />
      </Link>
    </div>
  );
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBoards() {
      try {
        const res = await fetch('/api/forum/boards');
        const data = await res.json();
        if (data.success) {
          setBoards(data.data);
        }
      } catch (error) {
        console.error('Error fetching boards:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBoards();
  }, []);

  // Group boards by category
  const officialBoards = boards.filter((b) => b.type !== 'user-created');
  const communityBoards = boards.filter((b) => b.type === 'user-created');

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-1/4" />
          <div className="h-24 bg-zinc-800 rounded" />
          <div className="h-24 bg-zinc-800 rounded" />
          <div className="h-24 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Discussion Boards</h1>
          <p className="text-zinc-400">Browse topics and join the conversation</p>
        </div>
        <Link
          href="/forums/boards/create"
          className="hidden sm:flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Create Board
        </Link>
      </div>

      {/* Official Boards */}
      {officialBoards.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare size={20} className="text-red-500" />
            Official Boards
          </h2>
          <div className="space-y-3">
            {officialBoards.map((board) => (
              <BoardRow key={board._id} board={board} />
            ))}
          </div>
        </section>
      )}

      {/* Community Boards */}
      {communityBoards.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users size={20} className="text-purple-500" />
            Community Boards
          </h2>
          <div className="space-y-3">
            {communityBoards.map((board) => (
              <BoardRow key={board._id} board={board} />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {boards.length === 0 && (
        <div className="text-center py-12 bg-zinc-900/50 border border-zinc-800 rounded-xl">
          <MessageSquare size={48} className="mx-auto text-zinc-700 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No boards yet</h3>
          <p className="text-zinc-400 mb-4">
            Be the first to create a discussion board!
          </p>
          <Link
            href="/forums/boards/create"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Create Board
          </Link>
        </div>
      )}
    </div>
  );
}
