'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Upload, 
  Globe, 
  Lock, 
  EyeOff,
  MapPin,
  Plus,
  X,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  { id: 'car-club', label: 'Car Club', description: 'General car enthusiast clubs' },
  { id: 'brand', label: 'Brand Specific', description: 'For fans of a specific brand (BMW, Toyota, etc.)' },
  { id: 'regional', label: 'Regional', description: 'Location-based car communities' },
  { id: 'racing', label: 'Racing', description: 'Track days, racing leagues, and motorsports' },
  { id: 'diy', label: 'DIY & Tech', description: 'Mechanical work, modifications, and tech' },
  { id: 'marketplace', label: 'Marketplace', description: 'Buying, selling, and trading' },
  { id: 'events', label: 'Events', description: 'Car shows, meets, and gatherings' },
  { id: 'other', label: 'Other', description: 'Everything else automotive' },
];

const privacyOptions = [
  { 
    id: 'public', 
    icon: Globe, 
    label: 'Public', 
    description: 'Anyone can find and join this group' 
  },
  { 
    id: 'private', 
    icon: Lock, 
    label: 'Private', 
    description: 'Anyone can find, but must request to join' 
  },
  { 
    id: 'secret', 
    icon: EyeOff, 
    label: 'Secret', 
    description: 'Only invited members can find and join' 
  },
];

export default function CreateGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'public' | 'private' | 'secret'>('public');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [location, setLocation] = useState({
    city: '',
    state: '',
    country: '',
  });
  const [rules, setRules] = useState<string[]>(['']);
  const [avatar, setAvatar] = useState('');
  const [banner, setBanner] = useState('');
  
  // Settings
  const [allowMemberInvites, setAllowMemberInvites] = useState(true);
  const [allowMemberPosts, setAllowMemberPosts] = useState(true);
  const [requirePostApproval, setRequirePostApproval] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('');

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const addRule = () => {
    if (rules.length < 10) {
      setRules([...rules, '']);
    }
  };

  const updateRule = (index: number, value: string) => {
    const newRules = [...rules];
    newRules[index] = value;
    setRules(newRules);
  };

  const removeRule = (index: number) => {
    if (rules.length > 1) {
      setRules(rules.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!category) {
      setError('Please select a category');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/forum/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          shortDescription: shortDescription.trim() || description.trim().substring(0, 200),
          category,
          type,
          tags,
          location: location.city || location.state || location.country ? location : undefined,
          rules: rules.filter(r => r.trim()),
          avatar,
          banner,
          settings: {
            allowMemberInvites,
            allowMemberPosts,
            requirePostApproval,
            showMemberList,
            welcomeMessage: welcomeMessage.trim(),
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/forums/groups/${data.data.slug}`);
      } else {
        setError(data.error || 'Failed to create group');
      }
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim() && description.trim();
      case 2:
        return category !== '';
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/forums/groups"
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Create Group</h1>
          <p className="text-zinc-400 text-sm">Build your community of car enthusiasts</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                s === step
                  ? 'bg-red-600 text-white'
                  : s < step
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-800 text-zinc-500'
              )}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={cn(
                  'flex-1 h-1 mx-2 rounded',
                  s < step ? 'bg-green-600' : 'bg-zinc-800'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
              <h2 className="text-lg font-semibold text-white">Basic Information</h2>
              
              {/* Group Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., SoCal JDM Enthusiasts"
                  maxLength={100}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-zinc-500">{name.length}/100 characters</p>
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Short Description
                </label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="A brief tagline for your group"
                  maxLength={200}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Full Description *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell people what your group is about, who it's for, and what kind of content they can expect..."
                  rows={5}
                  maxLength={5000}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                />
                <p className="mt-1 text-xs text-zinc-500">{description.length}/5000 characters</p>
              </div>

              {/* Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Avatar */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Group Avatar
                  </label>
                  <div className="relative">
                    {avatar ? (
                      <div className="relative">
                        <img
                          src={avatar}
                          alt="Avatar preview"
                          className="w-24 h-24 rounded-xl object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setAvatar('')}
                          className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center text-zinc-500 hover:border-zinc-600 cursor-pointer">
                        <ImageIcon size={24} />
                        <span className="text-xs mt-1">Avatar</span>
                      </div>
                    )}
                    <input
                      type="url"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                      placeholder="Image URL"
                      className="mt-2 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                {/* Banner */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Banner Image
                  </label>
                  <div className="relative">
                    {banner ? (
                      <div className="relative">
                        <img
                          src={banner}
                          alt="Banner preview"
                          className="w-full h-24 rounded-xl object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setBanner('')}
                          className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-full h-24 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center text-zinc-500 hover:border-zinc-600 cursor-pointer">
                        <Upload size={24} />
                        <span className="text-xs mt-1">Banner</span>
                      </div>
                    )}
                    <input
                      type="url"
                      value={banner}
                      onChange={(e) => setBanner(e.target.value)}
                      placeholder="Image URL"
                      className="mt-2 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Category & Privacy */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Category */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Category *</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={cn(
                      'p-4 rounded-lg border text-left transition-all',
                      category === cat.id
                        ? 'bg-red-600/10 border-red-500 ring-1 ring-red-500'
                        : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                    )}
                  >
                    <span className="font-medium text-white">{cat.label}</span>
                    <p className="text-xs text-zinc-400 mt-1">{cat.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Privacy</h2>
              <div className="space-y-3">
                {privacyOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setType(option.id as typeof type)}
                    className={cn(
                      'w-full p-4 rounded-lg border flex items-center gap-4 text-left transition-all',
                      type === option.id
                        ? 'bg-red-600/10 border-red-500 ring-1 ring-red-500'
                        : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                    )}
                  >
                    <div className={cn(
                      'p-3 rounded-lg',
                      type === option.id ? 'bg-red-600/20 text-red-400' : 'bg-zinc-700 text-zinc-400'
                    )}>
                      <option.icon size={20} />
                    </div>
                    <div>
                      <span className="font-medium text-white">{option.label}</span>
                      <p className="text-sm text-zinc-400">{option.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Tags</h2>
              <p className="text-sm text-zinc-400 mb-4">Add up to 10 tags to help people discover your group</p>
              
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={addTag}
                  disabled={tags.length >= 10}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="p-0.5 hover:bg-zinc-700 rounded-full"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Location */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MapPin size={20} />
                Location (Optional)
              </h2>
              <p className="text-sm text-zinc-400 mb-4">Help local enthusiasts find your group</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  value={location.city}
                  onChange={(e) => setLocation({ ...location, city: e.target.value })}
                  placeholder="City"
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <input
                  type="text"
                  value={location.state}
                  onChange={(e) => setLocation({ ...location, state: e.target.value })}
                  placeholder="State/Province"
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <input
                  type="text"
                  value={location.country}
                  onChange={(e) => setLocation({ ...location, country: e.target.value })}
                  placeholder="Country"
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Rules & Settings */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Rules */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Group Rules</h2>
              <p className="text-sm text-zinc-400 mb-4">Set guidelines for your community members</p>
              
              <div className="space-y-3">
                {rules.map((rule, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="flex items-center justify-center w-8 h-10 bg-zinc-800 rounded-lg text-zinc-500 text-sm">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={rule}
                      onChange={(e) => updateRule(index, e.target.value)}
                      placeholder="Enter a rule..."
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    {rules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        className="p-2 text-zinc-500 hover:text-red-400"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {rules.length < 10 && (
                <button
                  type="button"
                  onClick={addRule}
                  className="mt-4 flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
                >
                  <Plus size={16} />
                  Add Rule
                </button>
              )}
            </div>

            {/* Settings */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Group Settings</h2>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg cursor-pointer">
                  <div>
                    <span className="text-white">Allow member invites</span>
                    <p className="text-xs text-zinc-500">Members can invite others to join</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowMemberInvites}
                    onChange={(e) => setAllowMemberInvites(e.target.checked)}
                    className="w-5 h-5 rounded bg-zinc-700 border-zinc-600 text-red-600 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg cursor-pointer">
                  <div>
                    <span className="text-white">Allow member posts</span>
                    <p className="text-xs text-zinc-500">Members can create new threads</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowMemberPosts}
                    onChange={(e) => setAllowMemberPosts(e.target.checked)}
                    className="w-5 h-5 rounded bg-zinc-700 border-zinc-600 text-red-600 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg cursor-pointer">
                  <div>
                    <span className="text-white">Require post approval</span>
                    <p className="text-xs text-zinc-500">New posts need moderator approval</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={requirePostApproval}
                    onChange={(e) => setRequirePostApproval(e.target.checked)}
                    className="w-5 h-5 rounded bg-zinc-700 border-zinc-600 text-red-600 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg cursor-pointer">
                  <div>
                    <span className="text-white">Show member list</span>
                    <p className="text-xs text-zinc-500">Display members publicly</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={showMemberList}
                    onChange={(e) => setShowMemberList(e.target.checked)}
                    className="w-5 h-5 rounded bg-zinc-700 border-zinc-600 text-red-600 focus:ring-red-500"
                  />
                </label>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Welcome Message</h2>
              <p className="text-sm text-zinc-400 mb-4">This message will be shown to new members when they join</p>
              
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Welcome to the group! Please introduce yourself..."
                rows={4}
                maxLength={1000}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                Back
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <Link
              href="/forums/groups"
              className="px-6 py-2 text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </Link>
            
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !canProceed()}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Create Group
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
