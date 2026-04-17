'use client';

import { useState, useEffect } from 'react';
import { loadIdeaBank, removeFromIdeaBank, type SavedItem } from '@/lib/ideaBank';
import { copyToClipboard } from '@/lib/clipboard';
import IconButton from './IconButton';

interface ServerBookmark {
  id: string;
  runPageId: string;
  runName: string;
  type: string;
  text: string;
  metadata: Record<string, string>;
  savedAt: string;
}

interface Props {
  serverBookmarks?: ServerBookmark[] | null;
  loading?: boolean;
  onDelete?: (bookmark: ServerBookmark) => void;
}

export default function IdeaBankSection({ serverBookmarks, loading, onDelete }: Props = {}) {
  const [localItems, setLocalItems] = useState<SavedItem[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!serverBookmarks) {
      setLocalItems(loadIdeaBank());
    }
  }, [serverBookmarks]);

  const handleLocalDelete = (id: string) => {
    removeFromIdeaBank(id);
    setLocalItems(loadIdeaBank());
  };

  const handleCopy = async (text: string, id: string) => {
    await copyToClipboard(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const typeLabels: Record<string, string> = {
    hook: 'Hooks',
    title: 'Titles',
    claim: 'Claims',
    thumbnailText: 'Thumbnail Texts',
  };

  if (loading) {
    return (
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Idea Bank</h3>
        <div className="flex items-center gap-3 py-4 justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
          <span className="text-xs text-zinc-600">Loading bookmarks...</span>
        </div>
      </div>
    );
  }

  // Server bookmarks mode
  if (serverBookmarks) {
    if (serverBookmarks.length === 0) return null;

    const grouped = serverBookmarks.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {} as Record<string, ServerBookmark[]>);

    return (
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Idea Bank</h3>
        {Object.entries(grouped).map(([type, typeItems]) => (
          <div key={type} className="mb-6">
            <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">{typeLabels[type] || type}</p>
            <div className="flex flex-col gap-2">
              {typeItems.map(item => (
                <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 leading-relaxed">{item.text}</p>
                      <p className="text-xs text-zinc-700 mt-1 truncate">From: {item.runName}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <IconButton
                        icon={copied === item.id ? 'check' : 'copy'}
                        onClick={() => handleCopy(item.text, item.id)}
                        title="Copy"
                        active={copied === item.id}
                      />
                      {onDelete && (
                        <button
                          onClick={() => onDelete(item)}
                          className="text-zinc-700 hover:text-red-400 transition-colors p-1"
                          title="Remove"
                        >
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Local mode (guest)
  if (localItems.length === 0) return null;

  const grouped = localItems.reduce((acc, item) => {
    acc[item.type] = acc[item.type] || [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, SavedItem[]>);

  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Idea Bank</h3>
      {Object.entries(grouped).map(([type, typeItems]) => (
        <div key={type} className="mb-6">
          <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">{typeLabels[type] || type}</p>
          <div className="flex flex-col gap-2">
            {typeItems.map(item => (
              <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 leading-relaxed">{item.text}</p>
                    <p className="text-xs text-zinc-700 mt-1 truncate">From: {item.savedFrom}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <IconButton
                      icon={copied === item.id ? 'check' : 'copy'}
                      onClick={() => handleCopy(item.text, item.id)}
                      title="Copy"
                      active={copied === item.id}
                    />
                    <button
                      onClick={() => handleLocalDelete(item.id)}
                      className="text-zinc-700 hover:text-red-400 transition-colors p-1"
                      title="Remove"
                    >
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
