'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  MessageSquare, 
  HelpCircle, 
  Car, 
  Wrench, 
  ShoppingBag, 
  Calendar,
  BarChart3,
  Image as ImageIcon,
  X,
  Plus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Board {
  _id: string;
  name: string;
  slug: string;
  color: string;
}

interface Group {
  _id: string;
  name: string;
  slug: string;
}

const threadTypes = [
  { id: 'discussion', label: 'Discussion', icon: MessageSquare, description: 'Start a conversation' },
  { id: 'question', label: 'Question', icon: HelpCircle, description: 'Ask for help or advice' },
  { id: 'showcase', label: 'Showcase', icon: Car, description: 'Show off your ride' },
  { id: 'build-log', label: 'Build Log', icon: Wrench, description: 'Document your project' },
  { id: 'for-sale', label: 'For Sale', icon: ShoppingBag, description: 'Sell parts or vehicles' },
  { id: 'event', label: 'Event', icon: Calendar, description: 'Promote a meet or event' },
  { id: 'poll', label: 'Poll', icon: BarChart3, description: 'Get community opinions' },
];

export default function NewPostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedGroup = searchParams.get('group');
  
  const [loading, setLoading] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  // Form state
  const [type, setType] = useState('discussion');
  const [destination, setDestination] = useState<'board' | 'group'>(preselectedGroup ? 'group' : 'board');
  const [boardId, setBoardId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  
  // For sale specific
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('good');
  
  // Poll specific
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  useEffect(() => {
    async function fetchDestinations() {
      try {
        const [boardsRes, groupsRes] = await Promise.all([
          fetch('/api/forum/boards'),
          fetch('/api/forum/groups'),
        ]);
        
        const [boardsData, groupsData] = await Promise.all([
          boardsRes.json(),
          groupsRes.json(),
        ]);
        
        if (boardsData.success) setBoards(boardsData.data);
        if (groupsData.success) {
          setGroups(groupsData.data);
          
          // Pre-select group if provided in URL
          if (preselectedGroup) {
            const matchingGroup = groupsData.data.find(
              (g: Group) => g.slug === preselectedGroup || g._id === preselectedGroup
            );
            if (matchingGroup) {
              setGroupId(matchingGroup._id);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching destinations:', error);
      }
    }
    
    fetchDestinations();
  }, [preselectedGroup]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      alert('Title and content are required');
      return;
    }
    
    if (destination === 'board' && !boardId) {
      alert('Please select a board');
      return;
    }
    
    if (destination === 'group' && !groupId) {
      alert('Please select a group');
      return;
    }
    
    setLoading(true);
    
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim(),
        type,
        tags,
        images: images.map((url) => ({ url })),
      };
      
      if (destination === 'board') {
        body.boardId = boardId;
      } else {
        body.groupId = groupId;
      }
      
      if (type === 'for-sale' && price) {
        body.forSale = {
          price: parseFloat(price),
          currency: 'USD',
          condition,
        };
      }
      
      if (type === 'poll' && pollQuestion) {
        body.poll = {
          question: pollQuestion,
          options: pollOptions.filter((o) => o.trim()).map((text) => ({ text })),
          allowMultiple: false,
        };
      }
      
      const res = await fetch('/api/forum/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      
      if (data.success) {
        router.push(`/forums/thread/${data.data.slug}`);
      } else {
        alert(data.error || 'Failed to create post');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Create New Post</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Post Type */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            Post Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {threadTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors text-center',
                  type === t.id
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700'
                )}
              >
                <t.icon size={20} />
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Destination */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            Post To
          </label>
          <div className="flex gap-4 mb-3">
            <button
              type="button"
              onClick={() => setDestination('board')}
              className={cn(
                'flex-1 p-3 rounded-lg border transition-colors',
                destination === 'board'
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
              )}
            >
              <MessageSquare size={20} className={destination === 'board' ? 'text-red-400' : 'text-zinc-500'} />
              <span className={cn('ml-2 font-medium', destination === 'board' ? 'text-white' : 'text-zinc-400')}>
                Board
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDestination('group')}
              className={cn(
                'flex-1 p-3 rounded-lg border transition-colors',
                destination === 'group'
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
              )}
            >
              <MessageSquare size={20} className={destination === 'group' ? 'text-purple-400' : 'text-zinc-500'} />
              <span className={cn('ml-2 font-medium', destination === 'group' ? 'text-white' : 'text-zinc-400')}>
                Group
              </span>
            </button>
          </div>
          
          {destination === 'board' ? (
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Select a board...</option>
              {boards.map((board) => (
                <option key={board._id} value={board._id}>
                  {board.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select a group...</option>
              {groups.map((group) => (
                <option key={group._id} value={group._id}>
                  {group.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your post a title..."
            maxLength={200}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <p className="text-xs text-zinc-500 mt-1">{title.length}/200</p>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post content..."
            rows={8}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>

        {/* For Sale Fields */}
        {type === 'for-sale' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Price (USD)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="new">New</option>
                <option value="like-new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="parts">Parts Only</option>
              </select>
            </div>
          </div>
        )}

        {/* Poll Fields */}
        {type === 'poll' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Poll Question
              </label>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="What do you want to ask?"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Options
              </label>
              <div className="space-y-2">
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...pollOptions];
                        newOptions[index] = e.target.value;
                        setPollOptions(newOptions);
                      }}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePollOption(index)}
                        className="p-2 text-zinc-500 hover:text-red-400"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddPollOption}
                    className="text-sm text-red-500 hover:text-red-400"
                  >
                    + Add Option
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Tags (up to 5)
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          {tags.length < 5 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Images Placeholder */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Images
          </label>
          <div className="border-2 border-dashed border-zinc-800 rounded-lg p-8 text-center">
            <ImageIcon size={32} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-500">
              Drag and drop images here, or click to browse
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Image upload coming soon
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-6 py-3 bg-zinc-800 text-white rounded-lg font-medium hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !title.trim() || !content.trim()}
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Creating...
              </>
            ) : (
              'Create Post'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
