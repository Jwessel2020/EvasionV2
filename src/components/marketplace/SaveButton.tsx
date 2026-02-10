'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SaveButtonProps {
  listingId: string;
  initialSaved?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  onToggle?: (saved: boolean) => void;
}

export function SaveButton({
  listingId,
  initialSaved = false,
  size = 'md',
  showText = false,
  onToggle,
}: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);

  const handleClick = async () => {
    if (saving) return;
    setSaving(true);

    const newSaved = !saved;
    setSaved(newSaved);

    try {
      const res = await fetch('/api/marketplace/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });

      if (!res.ok) throw new Error();
      onToggle?.(newSaved);
    } catch {
      setSaved(!newSaved);
    } finally {
      setSaving(false);
    }
  };

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  if (showText) {
    return (
      <button
        onClick={handleClick}
        disabled={saving}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
          saved
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',
          saving && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Heart className={cn(iconSizes[size], saved && 'fill-current')} />
        <span>{saved ? 'Saved' : 'Save'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={saving}
      className={cn(
        'rounded-full transition-colors',
        sizeClasses[size],
        saved
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',
        saving && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Heart className={cn(iconSizes[size], saved && 'fill-current')} />
    </button>
  );
}
