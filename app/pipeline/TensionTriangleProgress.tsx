'use client';

import { useState, useEffect } from 'react';

type PipelineStage = 'claim' | 'hook' | 'thumbnail' | 'title';
type NodeStatus = 'pending' | 'active' | 'complete';

const AGENT_NAMES = ['Expert', 'Critic', 'Rewriter', 'Ranker'] as const;

const STAGE_LABELS: Record<PipelineStage, string> = {
  claim: 'claims',
  hook: 'hooks',
  thumbnail: 'thumbnail texts',
  title: 'titles',
};

const TIMINGS: Record<PipelineStage, number[]> = {
  claim: [0, 25, 55, 80],
  hook: [0, 12, 27, 40],
  thumbnail: [0, 12, 27, 40],
  title: [0, 12, 27, 40],
};

const DESCRIPTIONS: Record<PipelineStage, string[]> = {
  claim: [
    'Generating video briefs from your idea',
    'Scoring clarity, tension, and specificity',
    'Strengthening low-scoring briefs',
    'Selecting the top 5 for you',
  ],
  hook: [
    'Crafting hooks that stop the scroll',
    'Evaluating curiosity and cold-viewer pull',
    'Rewriting hooks that missed the mark',
    'Picking the top 5 hooks',
  ],
  thumbnail: [
    'Writing thumbnail text options',
    'Scoring visual impact and intrigue',
    'Reworking weak options',
    'Picking the top 5 texts',
  ],
  title: [
    'Generating title candidates',
    'Scoring CTR potential and clarity',
    'Improving underperforming titles',
    'Picking the top 5 titles',
  ],
};

const AGENT_ROLES = ['Generates options', 'Scores quality', 'Fixes weaknesses', 'Picks the best'];

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

export default function TensionTriangleProgress({ stage, isComplete = false }: { stage: PipelineStage; isComplete?: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const timings = TIMINGS[stage];
  const descriptions = DESCRIPTIONS[stage];

  useEffect(() => {
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  function getStatus(index: number): NodeStatus {
    if (isComplete) return 'complete';
    const nextAt = index < 3 ? timings[index + 1] : Infinity;
    if (elapsed < timings[index]) return 'pending';
    if (elapsed < nextAt) return 'active';
    return 'complete';
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="flex flex-col items-center gap-6 py-10">
      {/* Header */}
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-400">
          Your AI Team is generating <span className="text-orange-400">{STAGE_LABELS[stage]}</span>
        </p>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-4 gap-3 w-full max-w-2xl">
        {AGENT_NAMES.map((name, i) => {
          const status = getStatus(i);
          const Icon = ICONS[i];
          return (
            <div
              key={name}
              className={[
                'relative flex flex-col items-center rounded-xl border px-3 py-4 transition-all duration-500',
                status === 'pending' && 'border-zinc-800 bg-zinc-900/50 opacity-50',
                status === 'active' && 'border-orange-500/60 bg-zinc-900 shadow-[0_0_20px_rgba(249,115,22,0.1)]',
                status === 'complete' && 'border-zinc-700 bg-zinc-900/80',
              ].filter(Boolean).join(' ')}
            >
              {/* Icon */}
              <div
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 mb-2',
                  status === 'pending' && 'border-zinc-700 bg-zinc-800',
                  status === 'active' && 'border-orange-500 bg-zinc-800 animate-pulse',
                  status === 'complete' && 'border-orange-500 bg-orange-500',
                ].filter(Boolean).join(' ')}
              >
                {status === 'complete' ? (
                  <CheckIcon className="h-4 w-4 text-white" />
                ) : (
                  <Icon className={`h-4 w-4 transition-colors duration-500 ${status === 'active' ? 'text-orange-400' : 'text-zinc-600'}`} />
                )}
              </div>

              {/* Name */}
              <span className={`text-xs font-semibold tracking-wide transition-colors duration-500 ${
                status === 'active' ? 'text-white' : status === 'complete' ? 'text-zinc-500' : 'text-zinc-600'
              }`}>
                {name}
              </span>

              {/* Role */}
              <span className="text-[10px] text-zinc-600 mt-0.5">{AGENT_ROLES[i]}</span>

              {/* Active description */}
              <p className={`text-[11px] text-center leading-tight mt-2 transition-all duration-300 ${
                status === 'active' ? 'text-orange-400/80' : 'text-transparent h-0 overflow-hidden'
              }`}>
                {descriptions[i]}
              </p>

              {/* Status indicator */}
              {status === 'active' && (
                <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {/* Timer */}
      <p className="text-xs text-zinc-600 tabular-nums">
        {mins > 0 ? `${mins}m ` : ''}{secs.toString().padStart(2, '0')}s elapsed
      </p>
    </div>
  );
}
