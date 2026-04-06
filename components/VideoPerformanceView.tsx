'use client';

import { useState, useEffect } from 'react';

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;

interface VideoData {
  title: string;
  videoId: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  duration: string;
  impressions: number;
  ctr: number;
  avgViewDuration: number;
  avgPercentViewed: number;
  pipelineMatch: string;
  pipelineTitle: string;
  matchConfidence: string;
  lastUpdated: string;
}

function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const h = match[1] ? `${match[1]}:` : '';
  const m = match[2] || '0';
  const s = (match[3] || '0').padStart(2, '0');
  return h ? `${h}${m.padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function formatSeconds(s: number): string {
  if (!s) return '--';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoPerformanceView({ creatorName }: { creatorName: string }) {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!N8N_BASE || !creatorName) { setLoading(false); return; }

    fetch(`${N8N_BASE}/yt-get-performance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorName }),
    })
      .then(res => res.json())
      .then(data => {
        const result = Array.isArray(data) ? data[0] : data;
        setVideos(result.videos || []);
      })
      .catch(() => setError('Could not load video performance data'))
      .finally(() => setLoading(false));
  }, [creatorName]);

  if (loading) {
    return (
      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">Video Performance</h2>
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">Video Performance</h2>
        <p className="text-xs text-zinc-600">{error}</p>
      </div>
    );
  }

  if (videos.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Video Performance</h2>
        {videos[0]?.lastUpdated && (
          <span className="text-xs text-zinc-600">Last synced {formatDate(videos[0].lastUpdated)}</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {videos.map((video) => (
          <a
            key={video.videoId}
            href={`https://youtube.com/watch?v=${video.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 transition-all hover:border-zinc-700 block"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{video.title}</p>
                <div className="mt-1.5 flex items-center gap-4">
                  <span className="text-xs text-zinc-500">{formatDate(video.publishedAt)}</span>
                  <span className="text-xs text-zinc-500">{formatDuration(video.duration)}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-right">
                <div>
                  <p className="text-sm font-medium text-white">{formatNumber(video.views)}</p>
                  <p className="text-[10px] text-zinc-600">views</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300">{formatNumber(video.likes)}</p>
                  <p className="text-[10px] text-zinc-600">likes</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-400">{formatNumber(video.comments)}</p>
                  <p className="text-[10px] text-zinc-600">comments</p>
                </div>
              </div>
            </div>

            {(video.impressions > 0 || video.ctr > 0) && (
              <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center gap-5">
                <div>
                  <span className="text-xs font-medium text-emerald-400">{video.ctr}%</span>
                  <span className="text-[10px] text-zinc-600 ml-1">CTR</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-zinc-300">{formatNumber(video.impressions)}</span>
                  <span className="text-[10px] text-zinc-600 ml-1">impressions</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-zinc-300">{formatSeconds(video.avgViewDuration)}</span>
                  <span className="text-[10px] text-zinc-600 ml-1">avg watch</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-zinc-300">{video.avgPercentViewed}%</span>
                  <span className="text-[10px] text-zinc-600 ml-1">avg viewed</span>
                </div>
              </div>
            )}

            {video.pipelineTitle && video.matchConfidence !== 'none' && video.matchConfidence !== 'pending' && (
              <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center gap-2">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                  video.matchConfidence === 'exact' ? 'bg-emerald-500' :
                  video.matchConfidence === 'contains' ? 'bg-yellow-500' : 'bg-zinc-500'
                }`} />
                <span className="text-xs text-zinc-500">Pipeline: <span className="text-zinc-400">{video.pipelineTitle}</span></span>
                <span className="text-[10px] text-zinc-600">({video.matchConfidence})</span>
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
