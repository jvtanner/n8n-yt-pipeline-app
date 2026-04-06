'use client';

import { useState, useEffect } from 'react';
import { getHistory, type PipelineRun } from '@/lib/history';
import VideoAnalyticsCard from './VideoAnalyticsCard';

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
  estimatedMinutesWatched?: number;
  pipelineMatch: string;
  pipelineTitle: string;
  matchConfidence: string;
  lastUpdated: string;
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

function retentionColor(value: number): string {
  if (value >= 50) return 'text-emerald-400';
  if (value >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function ctrColor(value: number): string {
  if (value >= 5) return 'text-emerald-400';
  if (value >= 3) return 'text-orange-400';
  return 'text-red-400';
}

function findPipelineMatch(video: VideoData, history: PipelineRun[]) {
  if (!video.pipelineTitle) return undefined;
  return history.find(
    (run) =>
      run.chosenTitle === video.pipelineTitle ||
      video.pipelineTitle.includes(run.chosenTitle) ||
      run.chosenTitle.includes(video.pipelineTitle)
  );
}

function videoMaturityDays(publishedAt: string): number {
  if (!publishedAt) return 0;
  const pub = new Date(publishedAt);
  const now = new Date();
  return Math.floor((now.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AnalyticsDashboard({ creatorName }: { creatorName: string }) {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pipelineHistory, setPipelineHistory] = useState<PipelineRun[]>([]);

  useEffect(() => {
    setPipelineHistory(getHistory());
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

  // Analysis readiness: count videos with 7+ days of data
  const matureVideos = videos.filter(v => videoMaturityDays(v.publishedAt) >= 7).length;
  const analysisThreshold = 10;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Video Performance</h2>
        {videos[0]?.lastUpdated && (
          <span className="text-xs text-zinc-600">Last synced {formatDate(videos[0].lastUpdated)}</span>
        )}
      </div>

      {/* Analysis status */}
      <p className="text-xs text-zinc-500 mb-4">
        {matureVideos >= analysisThreshold ? (
          <span className="text-emerald-400">Pipeline analysis ready</span>
        ) : (
          <>{matureVideos} of {analysisThreshold} videos ready for pipeline analysis</>
        )}
      </p>

      {/* Video List */}
      <div className="flex flex-col gap-2">
        {videos.map((video) => {
          const isExpanded = expandedId === video.videoId;
          const pipelineMatch = findPipelineMatch(video, pipelineHistory);

          return (
            <div key={video.videoId}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : video.videoId)}
                className={`w-full rounded-xl border px-5 py-3 transition-all text-left ${
                  isExpanded
                    ? 'border-orange-500/40 bg-zinc-900'
                    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{video.title}</p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="text-xs text-zinc-500">{formatDate(video.publishedAt)}</span>
                      {video.ctr > 0 && (
                        <span className={`text-xs font-medium ${ctrColor(video.ctr)}`}>
                          {video.ctr}% CTR
                        </span>
                      )}
                      {video.avgPercentViewed > 0 && (
                        <span className={`text-xs ${retentionColor(video.avgPercentViewed)}`}>
                          {video.avgPercentViewed}% retained
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{formatNumber(video.views)}</p>
                      <p className="text-[10px] text-zinc-600">views</p>
                    </div>
                    <svg
                      className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-2">
                  <VideoAnalyticsCard
                    video={video}
                    pipeline={pipelineMatch ? {
                      chosenTitle: pipelineMatch.chosenTitle,
                      chosenThumbnailText: pipelineMatch.chosenThumbnailText,
                      chosenHook: pipelineMatch.chosenHook,
                      chosenIntro: pipelineMatch.chosenIntro,
                    } : undefined}
                  />
                  <div className="mt-2 mb-1 text-right">
                    <a
                      href={`https://youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      Open on YouTube
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
