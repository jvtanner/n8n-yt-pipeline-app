'use client';

import MetricBar from './MetricBar';

interface VideoAnalyticsData {
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
}

interface PipelineData {
  chosenTitle?: string;
  chosenThumbnailText?: string;
  chosenHook?: string;
  chosenIntro?: string;
}

function ctrColor(value: number): string {
  if (value >= 5) return 'text-emerald-400';
  if (value >= 3) return 'text-orange-400';
  return 'text-red-400';
}

function ctrBar(value: number): string {
  if (value >= 5) return 'bg-emerald-500';
  if (value >= 3) return 'bg-orange-500';
  return 'bg-red-500';
}

function ctrBorder(value: number): string {
  if (value >= 5) return 'border-emerald-500/40';
  if (value >= 3) return 'border-orange-500/40';
  return 'border-zinc-700';
}

function retentionColor(value: number): string {
  if (value >= 50) return 'text-emerald-400';
  if (value >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function retentionBar(value: number): string {
  if (value >= 50) return 'bg-emerald-500';
  if (value >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

function retentionBorder(value: number): string {
  if (value >= 50) return 'border-emerald-500/40';
  if (value >= 30) return 'border-orange-500/40';
  return 'border-zinc-700';
}

function formatSeconds(s: number): string {
  if (!s) return '--';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const h = match[1] ? `${match[1]}:` : '';
  const m = match[2] || '0';
  const s = (match[3] || '0').padStart(2, '0');
  return h ? `${h}${m.padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export default function VideoAnalyticsCard({
  video,
  pipeline,
}: {
  video: VideoAnalyticsData;
  pipeline?: PipelineData;
}) {
  const hasCtr = video.ctr > 0 || video.impressions > 0;

  return (
    <div className="flex flex-col gap-1 mt-3">
      {/* Zone 1: Thumbnail + Title → CTR / Views */}
      <div className={`rounded-lg border-l-2 ${hasCtr ? ctrBorder(video.ctr) : 'border-zinc-700'} bg-zinc-900/60 px-4 py-3`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-3">
            {hasCtr ? (
              <>
                <span className={`text-2xl font-semibold ${ctrColor(video.ctr)}`}>{video.ctr}%</span>
                <span className="text-xs text-zinc-500">CTR</span>
              </>
            ) : (
              <>
                <span className="text-2xl font-semibold text-white">{formatNumber(video.views)}</span>
                <span className="text-xs text-zinc-500">views</span>
              </>
            )}
          </div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">Thumbnail + Title</span>
        </div>
        {hasCtr && <MetricBar value={video.ctr} max={15} color={ctrBar(video.ctr)} />}
        <div className="mt-2 flex items-center gap-4">
          {hasCtr && <span className="text-xs text-zinc-500">{formatNumber(video.impressions)} impressions</span>}
          {hasCtr && <span className="text-xs text-zinc-500">{formatNumber(video.views)} views</span>}
          {!hasCtr && (
            <>
              <span className="text-xs text-zinc-400">{formatNumber(video.likes)} likes</span>
              <span className="text-xs text-zinc-400">{formatNumber(video.comments)} comments</span>
            </>
          )}
        </div>
        {pipeline?.chosenThumbnailText && (
          <div className="mt-2 pt-2 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-600 mb-0.5">Pipeline thumbnail</p>
            <p className="text-xs text-zinc-400">{pipeline.chosenThumbnailText}</p>
          </div>
        )}
      </div>

      {/* Zone 2: Hook → Watch time */}
      <div className={`rounded-lg border-l-2 ${retentionBorder(video.avgPercentViewed)} bg-zinc-900/60 px-4 py-3`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-3">
            <span className={`text-2xl font-semibold ${retentionColor(video.avgPercentViewed)}`}>
              {video.avgViewDuration > 0 ? formatSeconds(video.avgViewDuration) : '--'}
            </span>
            <span className="text-xs text-zinc-500">avg watch time</span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">Hook</span>
        </div>
        {video.avgPercentViewed > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <MetricBar value={video.avgPercentViewed} max={100} color={retentionBar(video.avgPercentViewed)} />
            </div>
            <span className={`text-xs font-medium ${retentionColor(video.avgPercentViewed)}`}>
              {video.avgPercentViewed}%
            </span>
          </div>
        )}
        <div className="mt-2">
          <span className="text-xs text-zinc-500">of {formatDuration(video.duration)} total</span>
        </div>
        {pipeline?.chosenHook && (
          <div className="mt-2 pt-2 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-600 mb-0.5">Pipeline hook</p>
            <p className="text-xs text-zinc-400 line-clamp-2">{pipeline.chosenHook}</p>
          </div>
        )}
      </div>

      {/* Zone 3: Intro → Retention */}
      <div className={`rounded-lg border-l-2 ${retentionBorder(video.avgPercentViewed)} bg-zinc-900/60 px-4 py-3`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-3">
            <span className={`text-2xl font-semibold ${retentionColor(video.avgPercentViewed)}`}>
              {video.avgPercentViewed > 0 ? `${video.avgPercentViewed}%` : '--'}
            </span>
            <span className="text-xs text-zinc-500">avg viewed</span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">Intro</span>
        </div>
        {video.avgPercentViewed > 0 && (
          <MetricBar value={video.avgPercentViewed} max={100} color={retentionBar(video.avgPercentViewed)} />
        )}
        {(video.estimatedMinutesWatched ?? 0) > 0 && (
          <div className="mt-2">
            <span className="text-xs text-zinc-500">{formatNumber(video.estimatedMinutesWatched!)} min watched</span>
          </div>
        )}
        {pipeline?.chosenIntro && (
          <div className="mt-2 pt-2 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-600 mb-0.5">Pipeline intro</p>
            <p className="text-xs text-zinc-400 line-clamp-2">{pipeline.chosenIntro}</p>
          </div>
        )}
      </div>

      {/* Pipeline match footer */}
      {video.pipelineTitle && video.matchConfidence !== 'none' && video.matchConfidence !== 'pending' && (
        <div className="flex items-center gap-2 px-1 pt-1">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${
            video.matchConfidence === 'exact' ? 'bg-emerald-500' :
            video.matchConfidence === 'contains' ? 'bg-yellow-500' : 'bg-zinc-500'
          }`} />
          <span className="text-[10px] text-zinc-500">
            Pipeline: <span className="text-zinc-400">{video.pipelineTitle}</span>
          </span>
          <span className="text-[10px] text-zinc-600">({video.matchConfidence})</span>
        </div>
      )}
    </div>
  );
}
