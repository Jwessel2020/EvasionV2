'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  MessageSquare, 
  Heart, 
  Share2, 
  Bookmark, 
  MoreHorizontal,
  Eye,
  Clock,
  ChevronLeft,
  Reply,
  CheckCircle,
  Send,
  ThumbsUp,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Author {
  _id: string;
  username: string;
  displayName: string;
  avatar?: string;
  reputation: number;
  role: string;
}

interface Thread {
  _id: string;
  title: string;
  slug: string;
  content: string;
  type: string;
  status: string;
  author: Author;
  board?: {
    _id: string;
    name: string;
    slug: string;
    color: string;
  };
  group?: {
    _id: string;
    name: string;
    slug: string;
  };
  tags: string[];
  images: { url: string; caption?: string }[];
  viewCount: number;
  replyCount: number;
  likeCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  lastReplyAt?: string;
}

interface Comment {
  _id: string;
  content: string;
  author: Author;
  parentComment?: string;
  depth: number;
  likeCount: number;
  replyCount: number;
  isAcceptedAnswer: boolean;
  createdAt: string;
  editedAt?: string;
}

function CommentComponent({ 
  comment, 
  threadId,
  onReply,
}: { 
  comment: Comment; 
  threadId: string;
  onReply: (parentId: string) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const handleLike = async () => {
    try {
      const res = await fetch('/api/forum/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment._id, type: 'like' }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.data.action === 'added') {
          setLiked(true);
          setLikeCount((c) => c + 1);
        } else if (data.data.action === 'removed') {
          setLiked(false);
          setLikeCount((c) => c - 1);
        }
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const loadReplies = async () => {
    setLoadingReplies(true);
    try {
      const res = await fetch(`/api/forum/comments?thread=${threadId}&parent=${comment._id}`);
      const data = await res.json();
      if (data.success) {
        setReplies(data.data);
      }
    } catch (error) {
      console.error('Error loading replies:', error);
    } finally {
      setLoadingReplies(false);
    }
  };

  useEffect(() => {
    if (showReplies && replies.length === 0 && comment.replyCount > 0) {
      loadReplies();
    }
  }, [showReplies]);

  return (
    <div className={cn('relative', comment.depth > 0 && 'ml-8 pl-4 border-l-2 border-zinc-800')}>
      {comment.isAcceptedAnswer && (
        <div className="absolute -left-px top-0 w-1 h-full bg-green-500 rounded-full" />
      )}
      
      <div className="py-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {comment.author.avatar ? (
            <img
              src={comment.author.avatar}
              alt={comment.author.username}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 font-medium text-sm">
              {comment.author.username[0].toUpperCase()}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href={`/forums/user/${comment.author.username}`}
                className="font-medium text-white hover:text-red-400"
              >
                {comment.author.displayName}
              </Link>
              {comment.author.role !== 'member' && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  comment.author.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                )}>
                  {comment.author.role}
                </span>
              )}
              {comment.isAcceptedAnswer && (
                <span className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                  <CheckCircle size={12} />
                  Best Answer
                </span>
              )}
              <span className="text-xs text-zinc-500">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
              {comment.editedAt && (
                <span className="text-xs text-zinc-600">(edited)</span>
              )}
            </div>
            
            {/* Content */}
            <div className="text-zinc-300 text-sm whitespace-pre-wrap mb-2">
              {comment.content}
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleLike}
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors',
                  liked ? 'text-red-400' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                <ThumbsUp size={14} fill={liked ? 'currentColor' : 'none'} />
                {likeCount > 0 && likeCount}
              </button>
              
              <button
                onClick={() => onReply(comment._id)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
              >
                <Reply size={14} />
                Reply
              </button>
              
              {comment.replyCount > 0 && (
                <button
                  onClick={() => setShowReplies(!showReplies)}
                  className="text-xs text-red-500 hover:text-red-400"
                >
                  {showReplies ? 'Hide' : 'Show'} {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Replies */}
        {showReplies && (
          <div className="mt-4">
            {loadingReplies ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={20} className="animate-spin text-zinc-500" />
              </div>
            ) : (
              replies.map((reply) => (
                <CommentComponent
                  key={reply._id}
                  comment={reply}
                  threadId={threadId}
                  onReply={onReply}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ThreadPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [thread, setThread] = useState<Thread | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  
  // Reply state
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchThread() {
      try {
        // For now, we'll fetch from the threads list and find by slug
        // In production, you'd have a dedicated endpoint
        const res = await fetch(`/api/forum/threads?search=${slug}&limit=1`);
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
          // Get full thread content
          setThread(data.data[0]);
          
          // Fetch comments
          const commentsRes = await fetch(`/api/forum/comments?thread=${data.data[0]._id}&parent=null`);
          const commentsData = await commentsRes.json();
          if (commentsData.success) {
            setComments(commentsData.data);
          }
        }
      } catch (error) {
        console.error('Error fetching thread:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchThread();
  }, [slug]);

  const handleLike = async () => {
    if (!thread) return;
    
    try {
      const res = await fetch('/api/forum/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: thread._id, type: 'like' }),
      });
      const data = await res.json();
      if (data.success) {
        setLiked(data.data.action !== 'removed');
      }
    } catch (error) {
      console.error('Error liking thread:', error);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread || !replyContent.trim() || submitting) return;
    
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        threadId: thread._id,
        content: replyContent.trim(),
      };
      
      if (replyingTo) {
        body.parentCommentId = replyingTo;
      }
      
      const res = await fetch('/api/forum/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      
      if (data.success) {
        if (!replyingTo) {
          // Add to top-level comments
          setComments([...comments, data.data]);
        }
        setReplyContent('');
        setReplyingTo(null);
      } else {
        alert(data.error || 'Failed to post reply');
      }
    } catch (error) {
      console.error('Error posting reply:', error);
      alert('Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
          <div className="h-8 bg-zinc-800 rounded w-3/4" />
          <div className="h-4 bg-zinc-800 rounded w-1/4" />
          <div className="h-64 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold text-white mb-2">Thread not found</h1>
        <p className="text-zinc-400 mb-4">This thread may have been deleted or moved.</p>
        <Link href="/forums" className="text-red-500 hover:text-red-400">
          Back to Forums
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href={thread.board ? `/forums/boards/${thread.board.slug}` : '/forums'}
        className="inline-flex items-center gap-1 text-zinc-400 hover:text-white mb-4"
      >
        <ChevronLeft size={16} />
        Back to {thread.board?.name || 'Community'}
      </Link>

      {/* Thread Header */}
      <article className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden mb-6">
        {/* Images */}
        {thread.images.length > 0 && (
          <div className="grid grid-cols-2 gap-1">
            {thread.images.slice(0, 4).map((img, i) => (
              <img
                key={i}
                src={img.url}
                alt={img.caption || ''}
                className={cn(
                  'w-full object-cover',
                  thread.images.length === 1 ? 'col-span-2 max-h-96' : 'h-48'
                )}
              />
            ))}
          </div>
        )}

        <div className="p-6">
          {/* Meta */}
          <div className="flex items-center gap-2 mb-3">
            {thread.board && (
              <Link
                href={`/forums/boards/${thread.board.slug}`}
                className="text-xs px-2 py-1 rounded-full"
                style={{ backgroundColor: `${thread.board.color}20`, color: thread.board.color }}
              >
                {thread.board.name}
              </Link>
            )}
            {thread.isPinned && (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                Pinned
              </span>
            )}
            {thread.isLocked && (
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-700 text-zinc-400">
                Locked
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-4">{thread.title}</h1>

          {/* Author */}
          <div className="flex items-center gap-3 mb-4">
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
            <div>
              <Link
                href={`/forums/user/${thread.author.username}`}
                className="font-medium text-white hover:text-red-400"
              >
                {thread.author.displayName}
              </Link>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>{thread.author.reputation} rep</span>
                <span>·</span>
                <span>{format(new Date(thread.createdAt), 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="prose prose-invert prose-sm max-w-none mb-4">
            <p className="text-zinc-300 whitespace-pre-wrap">{thread.content}</p>
          </div>

          {/* Tags */}
          {thread.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {thread.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/forums?tag=${tag}`}
                  className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Stats & Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-4 text-sm text-zinc-500">
              <span className="flex items-center gap-1">
                <Eye size={16} />
                {thread.viewCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare size={16} />
                {thread.replyCount}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleLike}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors',
                  liked
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                )}
              >
                <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
                {thread.likeCount}
              </button>
              
              <button
                onClick={() => setBookmarked(!bookmarked)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  bookmarked
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                )}
              >
                <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
              </button>
              
              <button className="p-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg">
                <Share2 size={16} />
              </button>
              
              <button className="p-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Comments Section */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          {thread.replyCount} {thread.replyCount === 1 ? 'Reply' : 'Replies'}
        </h2>

        {/* Reply Form */}
        {!thread.isLocked && (
          <form onSubmit={handleSubmitReply} className="mb-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              {replyingTo && (
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-zinc-400">Replying to a comment</span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="text-red-500 hover:text-red-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                rows={3}
                className="w-full bg-transparent text-white placeholder:text-zinc-500 focus:outline-none resize-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={!replyContent.trim() || submitting}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Post Reply
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Comments List */}
        <div className="divide-y divide-zinc-800">
          {comments.map((comment) => (
            <CommentComponent
              key={comment._id}
              comment={comment}
              threadId={thread._id}
              onReply={(parentId) => {
                setReplyingTo(parentId);
                // Scroll to reply form
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ))}
        </div>

        {comments.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
            <p>No replies yet. Be the first to respond!</p>
          </div>
        )}
      </section>
    </div>
  );
}
