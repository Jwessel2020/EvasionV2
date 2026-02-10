'use client';

import { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Send, Paperclip, DollarSign, MoreVertical,
  Package, User, Check, CheckCheck, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  _id: string;
  conversation: string;
  sender: string;
  senderUsername: string;
  senderAvatar?: string;
  content: string;
  attachments?: { type: string; url: string; name?: string }[];
  offer?: {
    amount: number;
    status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired';
    counterAmount?: number;
    counterMessage?: string;
    respondedAt?: string;
  };
  messageType: 'text' | 'offer' | 'system';
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

interface Conversation {
  _id: string;
  participants: string[];
  participantUsernames: string[];
  listingTitle?: string;
  listingImage?: string;
  listingPrice?: number;
  listing?: string;
  status: string;
}

interface OtherUser {
  _id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  reputation?: number;
  lastActiveAt?: string;
}

interface Listing {
  _id: string;
  title: string;
  slug: string;
  price: number;
  condition: string;
  images: { url: string }[];
  status: string;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isYesterday) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(price);
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConversation();
    fetchCurrentUser();
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/forum/users?self=true');
      const data = await res.json();
      if (data.success && data.data) {
        setCurrentUserId(data.data._id);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchConversation = async () => {
    try {
      const res = await fetch(`/api/marketplace/messages/conversations/${id}`);
      const data = await res.json();

      if (data.success) {
        setConversation(data.data.conversation);
        setMessages(data.data.messages);
        setOtherUser(data.data.otherUser);
        setListing(data.data.listing);
      }
    } catch (err) {
      console.error('Failed to fetch conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const res = await fetch(`/api/marketplace/messages/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.data]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessage(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleMakeOffer = async () => {
    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount <= 0 || sending) return;

    setSending(true);

    try {
      const res = await fetch(`/api/marketplace/messages/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer: {
            amount,
            message: offerMessage,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.data]);
        setShowOfferModal(false);
        setOfferAmount('');
        setOfferMessage('');
      }
    } catch (err) {
      console.error('Failed to make offer:', err);
    } finally {
      setSending(false);
    }
  };

  const handleOfferResponse = async (messageId: string, action: 'accept' | 'reject', counterAmount?: number) => {
    try {
      const res = await fetch(`/api/marketplace/offers/${messageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, counterAmount }),
      });

      const data = await res.json();
      if (data.success) {
        fetchConversation(); // Refresh messages
      }
    } catch (err) {
      console.error('Failed to respond to offer:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (!conversation || !otherUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto" />
          <h2 className="text-xl font-bold text-white">Conversation not found</h2>
          <Link
            href="/marketplace/messages"
            className="inline-flex items-center gap-2 text-red-400 hover:text-red-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to messages
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-zinc-800">
        <Link
          href="/marketplace/messages"
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </Link>

        <div className="flex items-center gap-3 flex-grow">
          {otherUser.avatar ? (
            <img
              src={otherUser.avatar}
              alt={otherUser.username}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
              <User className="w-5 h-5 text-zinc-400" />
            </div>
          )}
          <div>
            <Link
              href={`/forums/user/${otherUser.username}`}
              className="font-medium text-white hover:text-red-400"
            >
              {otherUser.displayName || otherUser.username}
            </Link>
            <p className="text-xs text-zinc-500">@{otherUser.username}</p>
          </div>
        </div>

        <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
          <MoreVertical className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Listing Context */}
      {listing && (
        <Link
          href={`/marketplace/${listing.slug}`}
          className="flex items-center gap-3 p-3 bg-zinc-800/50 border-b border-zinc-800 hover:bg-zinc-800 transition-colors"
        >
          {listing.images[0] && (
            <img
              src={listing.images[0].url}
              alt={listing.title}
              className="w-12 h-12 rounded object-cover"
            />
          )}
          <div className="flex-grow min-w-0">
            <p className="text-sm text-white truncate">{listing.title}</p>
            <p className="text-sm font-medium text-green-400">{formatPrice(listing.price)}</p>
          </div>
          <span className={cn(
            'px-2 py-0.5 text-xs rounded',
            listing.status === 'active'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-zinc-700 text-zinc-400'
          )}>
            {listing.status}
          </span>
        </Link>
      )}

      {/* Messages */}
      <div className="flex-grow overflow-y-auto py-4 space-y-4">
        {messages.map((message) => {
          const isMe = message.sender === currentUserId;

          return (
            <div
              key={message._id}
              className={cn(
                'flex gap-3',
                isMe ? 'flex-row-reverse' : ''
              )}
            >
              {/* Avatar */}
              {!isMe && (
                <div className="flex-shrink-0">
                  {message.senderAvatar ? (
                    <img
                      src={message.senderAvatar}
                      alt={message.senderUsername}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                      <User className="w-4 h-4 text-zinc-400" />
                    </div>
                  )}
                </div>
              )}

              {/* Message Content */}
              <div className={cn('max-w-[70%]', isMe ? 'text-right' : '')}>
                {/* Offer Message */}
                {message.offer && (
                  <div className={cn(
                    'p-4 rounded-xl mb-2',
                    isMe
                      ? 'bg-violet-600/20 border border-violet-500/30'
                      : 'bg-zinc-800 border border-zinc-700'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-medium text-violet-400">
                        {message.offer.status === 'pending' ? 'Offer' : `Offer ${message.offer.status}`}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-white mb-2">
                      {formatPrice(message.offer.amount)}
                    </p>
                    {message.offer.counterAmount && (
                      <p className="text-sm text-amber-400 mb-2">
                        Counter: {formatPrice(message.offer.counterAmount)}
                      </p>
                    )}
                    {message.offer.status === 'pending' && !isMe && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleOfferResponse(message._id, 'accept')}
                          className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleOfferResponse(message._id, 'reject')}
                          className="flex-1 py-2 bg-zinc-700 text-white rounded-lg text-sm font-medium hover:bg-zinc-600"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {message.offer.status !== 'pending' && (
                      <div className={cn(
                        'mt-2 text-sm',
                        message.offer.status === 'accepted' ? 'text-green-400' :
                          message.offer.status === 'rejected' ? 'text-red-400' :
                            'text-amber-400'
                      )}>
                        {message.offer.status === 'accepted' && 'Offer accepted'}
                        {message.offer.status === 'rejected' && 'Offer declined'}
                        {message.offer.status === 'countered' && 'Counter offer made'}
                      </div>
                    )}
                  </div>
                )}

                {/* Text Message */}
                {message.messageType === 'text' && (
                  <div className={cn(
                    'px-4 py-2 rounded-2xl',
                    isMe
                      ? 'bg-red-600 text-white rounded-br-md'
                      : 'bg-zinc-800 text-white rounded-bl-md'
                  )}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                )}

                {/* System Message */}
                {message.messageType === 'system' && (
                  <div className="text-center">
                    <span className="text-sm text-zinc-500 bg-zinc-800/50 px-3 py-1 rounded-full">
                      {message.content}
                    </span>
                  </div>
                )}

                {/* Time & Status */}
                <div className={cn(
                  'flex items-center gap-1 mt-1 text-xs text-zinc-500',
                  isMe ? 'justify-end' : ''
                )}>
                  <span>{formatTime(message.createdAt)}</span>
                  {isMe && (
                    message.isRead
                      ? <CheckCheck className="w-3 h-3 text-blue-400" />
                      : <Check className="w-3 h-3" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 pt-4">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {listing && (
            <button
              type="button"
              onClick={() => setShowOfferModal(true)}
              className="p-3 bg-zinc-800 text-violet-400 rounded-lg hover:bg-zinc-700 transition-colors"
              title="Make an offer"
            >
              <DollarSign className="w-5 h-5" />
            </button>
          )}
          <div className="flex-grow relative">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={cn(
              'p-3 rounded-lg transition-colors',
              newMessage.trim()
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-zinc-800 text-zinc-500'
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-md border border-zinc-800">
            <h3 className="text-xl font-bold text-white mb-4">Make an Offer</h3>

            {listing && (
              <div className="mb-4 p-3 bg-zinc-800 rounded-lg">
                <p className="text-sm text-zinc-400">Listing price</p>
                <p className="text-lg font-bold text-white">{formatPrice(listing.price)}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Your Offer</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                  <input
                    type="number"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Message (optional)</label>
                <textarea
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  placeholder="Add a note to your offer..."
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowOfferModal(false)}
                  className="flex-1 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMakeOffer}
                  disabled={!offerAmount || parseFloat(offerAmount) <= 0 || sending}
                  className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Offer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
