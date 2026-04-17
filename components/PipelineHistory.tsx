'use client';

import { useState, useEffect } from 'react';
import { getHistory, clearHistory, PipelineRun } from '@/lib/history';

interface ServerRun {
  id: string;
  date: string;
  name: string;
  rawIdea: string;
  chosenClaim: string;
  chosenHook: string;
  chosenIntro: string;
  chosenThumbnailText: string;
  chosenTitle: string;
  status: string;
  lane: string;
  thumbnailImageUrl?: string;
}

interface Props {
  serverRuns?: ServerRun[] | null;
  loading?: boolean;
}

export default function PipelineHistory({ serverRuns, loading }: Props = {}) {
  const [localRuns, setLocalRuns] = useState<PipelineRun[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!serverRuns) {
      setLocalRuns(getHistory());
    }
  }, [serverRuns]);

  const runs: { id: string; date: string; chosenTitle: string; chosenThumbnailText: string; chosenClaim: string; chosenHook: string; chosenIntro?: string; rawIdea: string; thumbnailImageUrl?: string; target_audience?: string; video_format?: string }[] =
    serverRuns
      ? serverRuns.map((r) => ({
          id: r.id,
          date: r.date,
          chosenTitle: r.chosenTitle || r.name,
          chosenThumbnailText: r.chosenThumbnailText,
          chosenClaim: r.chosenClaim,
          chosenHook: r.chosenHook,
          chosenIntro: r.chosenIntro || undefined,
          rawIdea: r.rawIdea,
          thumbnailImageUrl: r.thumbnailImageUrl,
        }))
      : localRuns.map((r) => ({
          id: r.id,
          date: r.date,
          chosenTitle: r.chosenTitle,
          chosenThumbnailText: r.chosenThumbnailText,
          chosenClaim: r.chosenClaim,
          chosenHook: r.chosenHook,
          chosenIntro: r.chosenIntro,
          rawIdea: r.rawIdea,
          thumbnailImageUrl: r.thumbnailImageUrl,
          target_audience: r.videoBrief?.target_audience,
          video_format: r.videoBrief?.video_format,
        }));

  if (loading) {
    return (
      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">Recent Runs</h2>
        <div className="flex items-center gap-3 py-8 justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
          <span className="text-xs text-zinc-600">Loading history...</span>
        </div>
      </div>
    );
  }

  if (runs.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Recent Runs</h2>
        {!serverRuns && (
          <button
            onClick={() => { clearHistory(); setLocalRuns([]); }}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Clear history
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {runs.map((run) => {
          const isExpanded = expandedId === run.id;
          return (
            <div
              key={run.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 transition-all hover:border-zinc-700"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : run.id)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{run.chosenTitle}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase text-orange-400/70">{run.chosenThumbnailText}</span>
                      <span className="text-xs text-zinc-700">&middot;</span>
                      <span className="text-xs text-zinc-500 truncate">{run.chosenClaim}</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-600">
                    {new Date(run.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                  {run.thumbnailImageUrl && (
                    <div className="mb-2">
                      <img src={run.thumbnailImageUrl} alt="Thumbnail" className="w-full rounded-lg aspect-video object-cover" />
                    </div>
                  )}
                  <div className="text-xs">
                    <span className="text-zinc-600 font-medium">Hook</span>
                    <p className="text-zinc-400 mt-0.5">{run.chosenHook}</p>
                  </div>
                  {run.chosenIntro && (
                    <div className="text-xs">
                      <span className="text-zinc-600 font-medium">Intro</span>
                      <p className="text-zinc-400 mt-0.5">{run.chosenIntro}</p>
                    </div>
                  )}
                  {run.target_audience && (
                    <div className="text-xs">
                      <span className="text-zinc-600 font-medium">Target audience</span>
                      <p className="text-zinc-400 mt-0.5">{run.target_audience}</p>
                    </div>
                  )}
                  {run.video_format && (
                    <div className="text-xs">
                      <span className="text-zinc-600 font-medium">Format</span>
                      <p className="text-zinc-400 mt-0.5">{run.video_format}</p>
                    </div>
                  )}
                  {run.rawIdea && (
                    <div className="text-xs">
                      <span className="text-zinc-600 font-medium">Raw idea</span>
                      <p className="text-zinc-400 mt-0.5">{run.rawIdea.slice(0, 200)}{run.rawIdea.length >= 200 ? '...' : ''}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
