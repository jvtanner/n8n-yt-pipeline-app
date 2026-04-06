'use client';

import { useState } from 'react';

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;

interface YouTubeChannelInputProps {
  creatorName: string;
  initialChannelUrl?: string;
}

export default function YouTubeChannelInput({ creatorName, initialChannelUrl }: YouTubeChannelInputProps) {
  const [channelUrl, setChannelUrl] = useState(initialChannelUrl || '');
  const [savedChannelId, setSavedChannelId] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('ytChannelId') || '' : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!savedChannelId);

  const saveChannel = async () => {
    if (!channelUrl.trim() || !N8N_BASE) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${N8N_BASE}/yt-save-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorName, channelUrl: channelUrl.trim() }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      const channelId = result.channelId || '';
      localStorage.setItem('ytChannelId', channelId);
      localStorage.setItem('ytChannelUrl', channelUrl.trim());
      setSavedChannelId(channelId);
      setEditing(false);
    } catch {
      setError('Could not find that channel. Try pasting the full URL.');
    } finally {
      setSaving(false);
    }
  };

  if (savedChannelId && !editing) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white"/></svg>
          <span className="text-xs text-zinc-400">Connected: <span className="text-zinc-300">{savedChannelId}</span></span>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <p className="text-xs font-medium text-zinc-400 mb-2">YouTube Channel</p>
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
          placeholder="youtube.com/@YourHandle or channel URL"
          value={channelUrl}
          onChange={(e) => setChannelUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveChannel()}
        />
        <button
          onClick={saveChannel}
          disabled={!channelUrl.trim() || saving}
          className="shrink-0 rounded-lg bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Connect'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <p className="mt-1.5 text-xs text-zinc-600">Your AI Team will track video performance daily.</p>
    </div>
  );
}
