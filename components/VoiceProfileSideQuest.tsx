'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { INTERVIEW_TIERS, InterviewTier } from '@/lib/interview-prompt';

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;

interface VoiceProfileSideQuestProps {
  creatorName: string;
  onComplete: () => void;
}

// ─── Tier Colors ──────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, { border: string; activeBorder: string; text: string; bg: string; dot: string; hover: string }> = {
  voice: {
    border: 'border-blue-500/20',
    activeBorder: 'border-blue-500/40',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    dot: 'bg-blue-500',
    hover: 'hover:border-blue-500/30',
  },
  credentials: {
    border: 'border-emerald-500/20',
    activeBorder: 'border-emerald-500/40',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    dot: 'bg-emerald-500',
    hover: 'hover:border-emerald-500/30',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTierOutput(markdown: string, tier: InterviewTier): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = markdown.split('\n');
  let currentKey: string | null = null;
  let currentContent: string[] = [];

  // Build a lookup: normalized section name → field key
  const sectionLookup: Record<string, string> = {};
  for (const [name, key] of Object.entries(tier.sections)) {
    sectionLookup[name.toUpperCase()] = key;
  }

  function matchSection(text: string): string | null {
    const cleaned = text.replace(/[*_#]/g, '').trim().toUpperCase();
    // Exact match
    if (sectionLookup[cleaned]) return sectionLookup[cleaned];
    // Partial match — check if any section name is contained in the text
    for (const [name, key] of Object.entries(sectionLookup)) {
      if (cleaned.includes(name) || name.includes(cleaned)) return key;
    }
    return null;
  }

  for (const line of lines) {
    // Match ## Header, # Header, **Header**, or HEADER: patterns
    const headerMatch = line.match(/^#{1,3}\s+(.+)$/) || line.match(/^\*\*(.+?)\*\*\s*$/) || line.match(/^([A-Z][A-Z\s]+):?\s*$/);
    if (headerMatch) {
      const matched = matchSection(headerMatch[1]);
      if (matched) {
        if (currentKey) {
          sections[currentKey] = currentContent.join('\n').trim();
        }
        currentKey = matched;
        currentContent = [];
        continue;
      }
    }
    if (currentKey) {
      currentContent.push(line);
    }
  }
  if (currentKey) {
    sections[currentKey] = currentContent.join('\n').trim();
  }

  // If no sections were found, try to use the entire text as the first section
  if (Object.keys(sections).length === 0 && markdown.trim().length > 0) {
    const firstKey = Object.values(tier.sections)[0];
    if (firstKey) {
      sections[firstKey] = markdown.trim();
    }
  }

  return sections;
}

// ─── Tier Card ────────────────────────────────────────────────────────────────

function TierCard({
  tier,
  completed,
  active,
  onActivate,
  onSave,
  saving,
}: {
  tier: InterviewTier;
  completed: boolean;
  active: boolean;
  onActivate: () => void;
  onSave: (pastedResult: string) => void;
  saving: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [pastedResult, setPastedResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const colors = TIER_COLORS[tier.id] || TIER_COLORS.voice;

  const copyPrompt = useCallback(async () => {
    await navigator.clipboard.writeText(tier.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [tier.prompt]);

  const handleSave = () => {
    if (!pastedResult.trim()) return;
    const parsed = parseTierOutput(pastedResult, tier);
    const hasContent = Object.values(parsed).some(v => v.length > 0);
    if (!hasContent) {
      setError('Could not parse the output. Make sure you pasted the structured output with ## section headers.');
      return;
    }
    setError(null);
    onSave(pastedResult);
  };

  // Completed state
  if (completed && !active) {
    return (
      <div className={`rounded-xl border ${colors.border} bg-zinc-900/50 px-5 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`h-6 w-6 rounded-full ${colors.bg} flex items-center justify-center`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={colors.text}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-300">{tier.name} File</p>
            <p className="text-xs text-zinc-600">{tier.description}</p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.text}`}>Saved</span>
      </div>
    );
  }

  // Inactive state
  if (!active) {
    return (
      <button
        onClick={onActivate}
        className={`w-full rounded-xl border ${colors.border} bg-zinc-900 px-5 py-4 text-left transition-all ${colors.hover} hover:bg-zinc-800/80`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-6 w-6 rounded-full border ${colors.border} flex items-center justify-center`}>
              <div className={`h-2 w-2 rounded-full ${colors.dot} opacity-40`} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{tier.name} File</p>
              <p className="text-xs text-zinc-500">{tier.description}</p>
            </div>
          </div>
          <span className={`text-xs ${colors.text} opacity-60`}>Start</span>
        </div>
      </button>
    );
  }

  // Active state — expanded
  return (
    <div className={`rounded-xl border ${colors.activeBorder} bg-zinc-900 px-5 py-5 space-y-4`}>
      <div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
          <p className={`text-sm font-semibold ${colors.text}`}>{tier.name} File</p>
        </div>
        <p className="text-xs text-zinc-500 mt-1">{tier.description}</p>
      </div>

      {/* Instructions */}
      <div className={`rounded-lg bg-zinc-950 border ${colors.border} px-4 py-3`}>
        <ol className="text-xs text-zinc-400 space-y-1.5 list-decimal list-inside">
          <li>Copy the prompt below</li>
          <li>Paste it into a strong AI chatbot (like Claude Opus 4.6, GPT-5.4, or Gemini 3.1 Pro)</li>
          <li>Engage in a conversation</li>
          <li>Paste the result of the interview below</li>
        </ol>
      </div>

      {/* Copyable prompt */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-zinc-400">Interview prompt</p>
          <button
            onClick={copyPrompt}
            className={`text-xs ${colors.text} hover:opacity-80 transition-opacity`}
          >
            {copied ? 'Copied' : 'Copy prompt'}
          </button>
        </div>
        <div className={`max-h-32 overflow-y-auto rounded-lg border ${colors.border} bg-zinc-950 px-4 py-3 text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap`}>
          {tier.prompt.split('\n').slice(0, 6).join('\n')}...
        </div>
      </div>

      {/* Paste result */}
      <div>
        <p className="text-xs font-medium text-zinc-400 mb-2">Paste the structured output here</p>
        <textarea
          className={`w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm leading-relaxed text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600`}
          rows={6}
          placeholder="Paste the structured output from your AI conversation here..."
          value={pastedResult}
          onChange={(e) => setPastedResult(e.target.value)}
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <div className="mt-3">
          <button
            onClick={handleSave}
            disabled={!pastedResult.trim() || saving}
            className="rounded-lg bg-orange-500 px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : `Save ${tier.name.toLowerCase()} file`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VoiceProfileSideQuest({ creatorName, onComplete }: VoiceProfileSideQuestProps) {
  const router = useRouter();
  const [completedTiers, setCompletedTiers] = useState<Set<string>>(new Set());
  const [activeTierId, setActiveTierId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [allParsedData, setAllParsedData] = useState<Record<string, string>>({});
  const [showInterviews, setShowInterviews] = useState(false);

  const allDone = completedTiers.size === INTERVIEW_TIERS.length;
  const completedCount = completedTiers.size;

  const saveProfile = useCallback(async (merged: Record<string, string>) => {
    setSaving(true);
    setSaveError(false);
    try {
      if (N8N_BASE) {
        const res = await fetch(`${N8N_BASE}/yt-save-voice-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorName,
            targetAudience: merged.targetAudience || '',
            brandTone: merged.brandTone || '',
            coreBeliefs: merged.coreBeliefs || '',
            hardNos: merged.hardNos || '',
            proprietaryTerms: merged.proprietaryTerms || '',
            contentPillars: merged.contentPillars || '',
            wordsToAvoid: merged.wordsToAvoid || '',
            credentialsBio: merged.credentialsBio || '',
            originStory: merged.originStory || '',
            proofPoints: merged.proofPoints || '',
          }),
        });
        if (!res.ok) throw new Error('Save failed');
      }
      localStorage.setItem('ytPipelineProfile:' + creatorName, JSON.stringify(merged));
      setSaving(false);
      onComplete();
    } catch {
      setSaving(false);
      setSaveError(true);
    }
  }, [creatorName, onComplete]);

  const saveTier = useCallback(async (tier: InterviewTier, pastedResult: string) => {
    const parsed = parseTierOutput(pastedResult, tier);
    const merged = { ...allParsedData, ...parsed };
    setAllParsedData(merged);
    setCompletedTiers(prev => new Set([...prev, tier.id]));

    const nextTier = INTERVIEW_TIERS.find(t => !completedTiers.has(t.id) && t.id !== tier.id);
    setActiveTierId(nextTier?.id || null);

    const newCompleted = new Set([...completedTiers, tier.id]);
    if (newCompleted.size === INTERVIEW_TIERS.length) {
      await saveProfile(merged);
    }
  }, [allParsedData, completedTiers, saveProfile]);

  // Saving state — shown while the webhook is in-flight
  if (saving) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-6 py-12 flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
        <p className="text-sm text-zinc-400">Setting up your profile...</p>
      </div>
    );
  }

  // Save error state — shown if the webhook failed
  if (saveError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-zinc-900/80 px-6 py-8 flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-red-400">Failed to save profile</p>
          <p className="text-xs text-zinc-500 mt-1">Something went wrong while setting up your profile. Your interview data is safe.</p>
        </div>
        <button
          onClick={() => saveProfile(allParsedData)}
          className="rounded-lg bg-orange-500 px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-orange-400"
        >
          Try again
        </button>
      </div>
    );
  }

  // Initial choice — AI interviews or quick form
  if (!showInterviews) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-6 py-5">
        <p className="text-sm font-semibold text-white">Build Your Creator Files</p>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
          You{"'"}re about to create four AI-generated reference files that capture your identity, voice, brand, and credentials.
          These are yours to keep — hand any of them to any AI and it will instantly understand who you are and how you communicate.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => { setShowInterviews(true); setActiveTierId(INTERVIEW_TIERS[0].id); }}
            className="rounded-lg bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
          >
            Create with AI (recommended)
          </button>
          <button
            onClick={() => router.push('/setup?mode=form')}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-white transition-all"
          >
            Quick form
          </button>
        </div>
      </div>
    );
  }

  // Expanded — 4 tier interviews
  return (
    <div className="space-y-3">
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Your Creator Files</p>
          <div className="flex items-center gap-1">
            {INTERVIEW_TIERS.map((t) => {
              const c = TIER_COLORS[t.id] || TIER_COLORS.identity;
              return (
                <div
                  key={t.id}
                  className={`h-1.5 w-6 rounded-full transition-colors ${completedTiers.has(t.id) ? c.dot : 'bg-zinc-800'}`}
                />
              );
            })}
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          {allDone
            ? 'All files created. Your AI Team is fully personalized.'
            : `${completedCount} of ${INTERVIEW_TIERS.length} files complete. Each interview produces a reusable file you can hand to any AI.`
          }
        </p>
      </div>

      {INTERVIEW_TIERS.map((tier) => (
        <TierCard
          key={tier.id}
          tier={tier}
          completed={completedTiers.has(tier.id)}
          active={activeTierId === tier.id}
          onActivate={() => setActiveTierId(tier.id)}
          onSave={(result) => saveTier(tier, result)}
          saving={saving}
        />
      ))}

      {allDone && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-5 py-4 text-center">
          <p className="text-sm font-medium text-emerald-400">All creator files saved</p>
          <p className="text-xs text-zinc-500 mt-1">Your pipeline results will now reflect your unique voice and brand.</p>
        </div>
      )}
    </div>
  );
}
