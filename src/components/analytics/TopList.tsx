'use client';

interface TopListItem {
  name: string | null;
  count: number;
}

interface TopListProps {
  title: string;
  items: TopListItem[];
  maxItems?: number;
}

export function TopList({ title, items, maxItems = 5 }: TopListProps) {
  const displayItems = items.slice(0, maxItems);
  const maxCount = Math.max(...displayItems.map((i) => i.count), 1);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="space-y-3">
        {displayItems.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-300 truncate flex-1 mr-2">
                {item.name || 'Unknown'}
              </span>
              <span className="text-zinc-400 font-medium">
                {item.count.toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-violet-600 rounded-full transition-all duration-500"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
