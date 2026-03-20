'use client';

import { useState, useEffect, Fragment } from 'react';

type PipelineStage = 'claim' | 'hook' | 'thumbnail' | 'title';
type NodeStatus = 'pending' | 'active' | 'complete';

const AGENT_NAMES = ['Expert', 'Critic', 'Rewriter', 'Ranker'] as const;

const TIMINGS: Record<PipelineStage, number[]> = {
  claim: [0, 25, 55, 80],
  hook: [0, 12, 27, 40],
  thumbnail: [0, 12, 27, 40],
  title: [0, 12, 27, 40],
};

const DESCRIPTIONS: Record<PipelineStage, string[]> = {
  claim: [
    'Generating video briefs from your script',
    'Scoring on clarity, tension & specificity',
    'Strengthening low-scoring briefs',
    'Selecting the top 5 for you',
  ],
  hook: [
    'Crafting hooks that stop the scroll',
    'Evaluating curiosity & cold-viewer pull',
    'Rewriting hooks that missed the mark',
    'Picking the top 5 hooks',
  ],
  thumbnail: [
    'Writing thumbnail text options',
    'Scoring for visual impact & intrigue',
    'Reworking weak thumbnail options',
    'Picking the top 5 thumbnail texts',
  ],
  title: [
    'Generating title candidates',
    'Scoring for CTR potential & clarity',
    'Improving underperforming titles',
    'Picking the top 5 titles',
  ],
};

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function MagnifyingGlassIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const ICONS = [LightbulbIcon, MagnifyingGlassIcon, PencilIcon, TrophyIcon];

export default function TensionTriangleProgress({ stage }: { stage: PipelineStage }) {
  const [elapsed, setElapsed] = useState(0);
  const timings = TIMINGS[stage];
  const descriptions = DESCRIPTIONS[stage];

  useEffect(() => {
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  function getStatus(index: number): NodeStatus {
    const nextAt = index < 3 ? timings[index + 1] : Infinity;
    if (elapsed < timings[index]) return 'pending';
    if (elapsed < nextAt) return 'active';
    return 'complete';
  }

  function connectorPct(index: number): number {
    const start = timings[index];
    const end = timings[index + 1];
    if (elapsed <= start) return 0;
    if (elapsed >= end) return 100;
    return ((elapsed - start) / (end - start)) * 100;
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="flex flex-col items-center gap-8 py-12">
      <div className="flex items-start w-full max-w-xl">
        {AGENT_NAMES.map((name, i) => {
          const status = getStatus(i);
          const Icon = ICONS[i];
          return (
            <Fragment key={name}>
              <div className="flex flex-col items-center gap-2 z-10" style={{ minWidth: 80 }}>
                <div
                  className={[
                    'flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-500',
                    status === 'pending' && 'border-zinc-700 bg-zinc-900',
                    status === 'active' && 'border-orange-500 bg-zinc-900 node-glow',
                    status === 'complete' && 'border-orange-500 bg-orange-500',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {status === 'complete' ? (
                    <CheckIcon className="h-5 w-5 text-white" />
                  ) : (
                    <Icon
                      className={`h-5 w-5 transition-colors duration-500 ${
                        status === 'active' ? 'text-orange-400' : 'text-zinc-600'
                      }`}
                    />
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-colors duration-500 ${
                    status === 'active'
                      ? 'text-white'
                      : status === 'complete'
                        ? 'text-zinc-500'
                        : 'text-zinc-600'
                  }`}
                >
                  {name}
                </span>
                <p
                  className={`text-[11px] text-center leading-tight max-w-[120px] transition-all duration-300 ${
                    status === 'active' ? 'text-zinc-400 opacity-100' : 'text-transparent opacity-0 h-0 overflow-hidden'
                  }`}
                >
                  {descriptions[i]}
                </p>
              </div>
              {i < 3 && (
                <div className="flex-1 h-0.5 bg-zinc-800 rounded-full overflow-hidden mt-[23px] mx-1">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${connectorPct(i)}%` }}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
      <p className="text-xs text-zinc-600 tabular-nums">
        {mins > 0 ? `${mins}m ` : ''}
        {secs.toString().padStart(2, '0')}s elapsed
      </p>
    </div>
  );
}
