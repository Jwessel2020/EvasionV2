'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  MessageCircle, Search, Package, Clock, ChevronRight, Archive
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  _id: string;
  participants: string[];
  participantUsernames: string[];
  participantAvatars: (string | null)[];
  listingTitle?: string;
  listingImage?: string;
  listingPrice?: number;
  listing?: string;
  lastMessage?: {
    content: string;
    senderUsername: string;
    sentAt: string;
    isOffer: boolean;
  };
  unreadCount: number;
  messageCount: number;
  status: string;
  otherUser?: {
    _id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return date.toLocaleDateString();
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');

  useEffect(() => {
    fetchConversations();
  }, [filter]);

  const fetchConversations = async () => {
    try {
      const status = filter === 'archived' ? 'archived' : filter === 'active' ? 'active' : '';
      const url = `/api/marketplace/messages/conversations${status ? `?status=${status}` : ''}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setConversations(data.data);
        setTotalUnread(data.totalUnread || 0);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Messages</h1>
          <p className="text-zinc-400">
            {totalUnread > 0 ? `${totalUnread} unread` : 'No unread messages'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'archived'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
              filter === f
                ? 'bg-red-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            )}
          >
            {f === 'archived' && <Archive className="w-4 h-4 inline mr-1" />}
            {f}
          </button>
        ))}
      </div>

      {/* Conversations */}
      {conversations.length > 0 ? (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 divide-y divide-zinc-800">
          {conversations.map((conv) => (
            <Link
              key={conv._id}
              href={`/marketplace/messages/${conv._id}`}
              className="flex items-center gap-4 p-4 hover:bg-zinc-800/50 transition-colors"
            >
              {/* Avatar */}
              <div className="flex-shrink-0 relative">
                {conv.otherUser?.avatar ? (
                  <img
                    src={conv.otherUser.avatar}
                    alt={conv.otherUser.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-zinc-400" />
                  </div>
                )}
                {conv.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'font-medium truncate',
                    conv.unreadCount > 0 ? 'text-white' : 'text-zinc-300'
                  )}>
                    {conv.otherUser?.displayName || conv.otherUser?.username || 'Unknown User'}
                  </span>
                  <span className="text-xs text-zinc-500 flex-shrink-0">
                    {conv.lastMessage?.sentAt && formatTimeAgo(conv.lastMessage.sentAt)}
                  </span>
                </div>

                {/* Listing context */}
                {conv.listingTitle && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <Package className="w-3 h-3 text-zinc-500" />
                    <span className="text-xs text-zinc-500 truncate">
                      Re: {conv.listingTitle}
                    </span>
                  </div>
                )}

                {/* Last message */}
                <p className={cn(
                  'text-sm truncate mt-1',
                  conv.unreadCount > 0 ? 'text-zinc-300' : 'text-zinc-500'
                )}>
                  {conv.lastMessage?.content || 'No messages yet'}
                </p>
              </div>

              {/* Arrow */}
              <ChevronRight className="w-5 h-5 text-zinc-600 flex-shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-zinc-900 rounded-xl border border-zinc-800">
          <MessageCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No conversations</h3>
          <p className="text-zinc-400 mb-4">
            {filter === 'archived'
              ? 'You have no archived conversations'
              : 'Start a conversation by contacting a seller'}
          </p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Browse Marketplace
          </Link>
        </div>
      )}
    </div>
  );
}
