'use client';

import { useState, useCallback } from 'react';
import TensionTriangleProgress from './TensionTriangleProgress';

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Claim {
  id: string;
  claim: string;
  angle: string;
  whyThisIsTheClaim: string;
  target_audience?: string;
  pain_point?: string;
  video_format?: string;
  promise_structure?: string;
  viewer_transformation?: string;
  whyThisIsTheBrief?: string;
}

interface Hook {
  text: string;
  mechanism: string;
  information_gap: string;
  cold_viewer_check: string;
}

interface ThumbnailText {
  text: string;
  word_count: number;
  visual_concept: string;
  title_complement: string;
}

interface Title {
  text: string;
  character_count: number;
  formula: string;
  primary_keyword: string;
  thumbnail_complement: string;
}

interface Intro {
  id: string;
  text: string;
  credibility_angle: string;
  why_this_works: string;
}

type Stage =
  | 'script'
  | 'loading-claims'
  | 'select-claim'
  | 'loading-hooks'
  | 'select-hook'
  | 'loading-intros'
  | 'select-intro'
  | 'loading-thumbnails'
  | 'select-thumbnail'
  | 'loading-titles'
  | 'select-title'
  | 'saving'
  | 'done';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
      <p className="text-sm text-zinc-500">{label}</p>
    </div>
  );
}

function SectionHeader({ step, total, title, subtitle }: { step: number; total: number; title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-orange-500">
        Step {step} of {total}
      </p>
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
    </div>
  );
}

function SelectionPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
      <span className="mt-0.5 shrink-0 text-xs font-medium text-orange-500 w-20">{label}</span>
      <span className="text-sm text-zinc-300 leading-snug">{value}</span>
    </div>
  );
}

function ResultCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${highlight ? 'border-orange-500/40 bg-orange-500/5' : 'border-zinc-800 bg-zinc-900'}`}>
      <p className="text-xs font-medium text-zinc-600 mb-1">{label}</p>
      <p className={`text-sm leading-relaxed ${highlight ? 'text-orange-300 font-semibold text-base' : 'text-zinc-200'}`}>
        {value}
      </p>
    </div>
  );
}

function BriefField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="text-xs">
      <span className="text-zinc-600 font-medium">{label}</span>
      <p className="text-zinc-400 mt-0.5">{value}</p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  if (!N8N_BASE) {
    throw new Error('N8N webhook URL not configured. Set NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL.');
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok || res.status < 500 || attempt === retries) return res;
    await new Promise(r => setTimeout(r, 1000 * attempt));
  }
  return fetch(url, options);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [stage, setStage] = useState<Stage>('script');
  const [script, setScript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [claims, setClaims] = useState<Claim[]>([]);
  const [chosenClaim, setChosenClaim] = useState<Claim | null>(null);

  const [hooks, setHooks] = useState<Hook[]>([]);
  const [chosenHook, setChosenHook] = useState<Hook | null>(null);

  const [thumbnailTexts, setThumbnailTexts] = useState<ThumbnailText[]>([]);
  const [chosenThumbnail, setChosenThumbnail] = useState<ThumbnailText | null>(null);

  const [titles, setTitles] = useState<Title[]>([]);
  const [chosenTitle, setChosenTitle] = useState<Title | null>(null);

  const [intros, setIntros] = useState<Intro[]>([]);
  const [chosenIntro, setChosenIntro] = useState<Intro | null>(null);

  const [notionUrl, setNotionUrl] = useState<string | null>(null);
  const [pipelineComplete, setPipelineComplete] = useState<'claim' | 'hook' | 'thumbnail' | 'title' | null>(null);
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);

  // ── API calls ────────────────────────────────────────────────────────────

  const generateClaims = useCallback(async () => {
    if (!script.trim()) return;
    setError(null);
    setStage('loading-claims');
    setPipelineComplete(null);
    try {
      const res = await fetchWithRetry(`${N8N_BASE}/yt-claim-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawIdea: script.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const claimsArray: Claim[] = data.claims ?? [];
      if (!claimsArray.length) throw new Error('No claims returned');
      setClaims(claimsArray);
      setPipelineComplete('claim');
      await new Promise(r => setTimeout(r, 700));
      setStage('select-claim');
      setPipelineComplete(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate claims');
      setStage('script');
      setPipelineComplete(null);
    }
  }, [script]);

  const selectClaim = useCallback(async (claim: Claim) => {
    setChosenClaim(claim);
    setError(null);
    setStage('loading-hooks');
    setPipelineComplete(null);
    try {
      const res = await fetchWithRetry(`${N8N_BASE}/yt-hook-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdea: script.trim(),
          claim: claim.claim,
          target_audience: claim.target_audience || '',
          pain_point: claim.pain_point || '',
          video_format: claim.video_format || '',
          promise_structure: claim.promise_structure || '',
          viewer_transformation: claim.viewer_transformation || '',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const hooksArray: Hook[] = data.hooks ?? [];
      if (!hooksArray.length) throw new Error('No hooks returned');
      setHooks(hooksArray);
      setPipelineComplete('hook');
      await new Promise(r => setTimeout(r, 700));
      setStage('select-hook');
      setPipelineComplete(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate hooks');
      setStage('select-claim');
      setPipelineComplete(null);
    }
  }, [script]);

  const selectHook = useCallback(async (hook: Hook) => {
    setChosenHook(hook);
    setError(null);
    setStage('loading-intros');
    try {
      const res = await fetchWithRetry(`${N8N_BASE}/yt-intro-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdea: script.trim(),
          claim: chosenClaim!.claim,
          chosenHook: hook.text,
          target_audience: chosenClaim!.target_audience || '',
          pain_point: chosenClaim!.pain_point || '',
          video_format: chosenClaim!.video_format || '',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const introsArray: Intro[] = data.intros ?? [];
      if (!introsArray.length) throw new Error('No intros returned');
      setIntros(introsArray);
      setStage('select-intro');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate intros');
      setStage('select-hook');
    }
  }, [script, chosenClaim]);

  const selectIntro = useCallback(async (intro: Intro) => {
    setChosenIntro(intro);
    setError(null);
    setStage('loading-thumbnails');
    setPipelineComplete(null);
    try {
      const res = await fetchWithRetry(`${N8N_BASE}/yt-thumbnail-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdea: script.trim(),
          claim: chosenClaim!.claim,
          chosenHook: chosenHook!.text,
          target_audience: chosenClaim!.target_audience || '',
          pain_point: chosenClaim!.pain_point || '',
          video_format: chosenClaim!.video_format || '',
          promise_structure: chosenClaim!.promise_structure || '',
          viewer_transformation: chosenClaim!.viewer_transformation || '',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const thumbsArray: ThumbnailText[] = data.thumbnail_texts ?? [];
      if (!thumbsArray.length) throw new Error('No thumbnail texts returned');
      setThumbnailTexts(thumbsArray);
      setPipelineComplete('thumbnail');
      await new Promise(r => setTimeout(r, 700));
      setStage('select-thumbnail');
      setPipelineComplete(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate thumbnail texts');
      setStage('select-intro');
      setPipelineComplete(null);
    }
  }, [script, chosenClaim, chosenHook]);

  const skipIntro = useCallback(async () => {
    setChosenIntro(null);
    setError(null);
    setStage('loading-thumbnails');
    setPipelineComplete(null);
    try {
      const res = await fetchWithRetry(`${N8N_BASE}/yt-thumbnail-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdea: script.trim(),
          claim: chosenClaim!.claim,
          chosenHook: chosenHook!.text,
          target_audience: chosenClaim!.target_audience || '',
          pain_point: chosenClaim!.pain_point || '',
          video_format: chosenClaim!.video_format || '',
          promise_structure: chosenClaim!.promise_structure || '',
          viewer_transformation: chosenClaim!.viewer_transformation || '',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const thumbsArray: ThumbnailText[] = data.thumbnail_texts ?? [];
      if (!thumbsArray.length) throw new Error('No thumbnail texts returned');
      setThumbnailTexts(thumbsArray);
      setPipelineComplete('thumbnail');
      await new Promise(r => setTimeout(r, 700));
      setStage('select-thumbnail');
      setPipelineComplete(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate thumbnail texts');
      setStage('select-intro');
      setPipelineComplete(null);
    }
  }, [script, chosenClaim, chosenHook]);

  const selectThumbnail = useCallback(async (thumb: ThumbnailText) => {
    setChosenThumbnail(thumb);
    setError(null);
    setStage('loading-titles');
    setPipelineComplete(null);
    try {
      const res = await fetchWithRetry(`${N8N_BASE}/yt-title-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdea: script.trim(),
          claim: chosenClaim!.claim,
          chosenHook: chosenHook!.text,
          chosenThumbnailText: thumb.text,
          target_audience: chosenClaim!.target_audience || '',
          pain_point: chosenClaim!.pain_point || '',
          video_format: chosenClaim!.video_format || '',
          promise_structure: chosenClaim!.promise_structure || '',
          viewer_transformation: chosenClaim!.viewer_transformation || '',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const titlesArray: Title[] = data.titles ?? [];
      if (!titlesArray.length) throw new Error('No titles returned');
      setTitles(titlesArray);
      setPipelineComplete('title');
      await new Promise(r => setTimeout(r, 700));
      setStage('select-title');
      setPipelineComplete(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate titles');
      setStage('select-thumbnail');
      setPipelineComplete(null);
    }
  }, [script, chosenClaim, chosenHook]);

  const selectTitle = useCallback(async (title: Title) => {
    setChosenTitle(title);
    setStage('saving');
    setError(null);
    try {
      const res = await fetchWithRetry(`${N8N_BASE}/yt-save-to-notion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdea: script.trim(),
          chosenClaim: chosenClaim?.claim ?? '',
          chosenHook: chosenHook?.text ?? '',
          chosenIntro: chosenIntro?.text ?? '',
          chosenIntroAngle: chosenIntro?.credibility_angle ?? '',
          chosenThumbnailText: chosenThumbnail?.text ?? '',
          chosenTitle: title.text,
          claimOptions: claims.map((c, i) => `${i + 1}. ${c.claim}`).join('\n').slice(0, 2000),
          hookOptions: hooks.map((h, i) => `${i + 1}. ${h.text}`).join('\n').slice(0, 2000),
          thumbnailOptions: thumbnailTexts.map((t, i) => `${i + 1}. ${t.text}`).join('\n').slice(0, 2000),
          titleOptions: titles.map((t, i) => `${i + 1}. ${t.text}`).join('\n').slice(0, 2000),
          target_audience: chosenClaim?.target_audience ?? '',
          pain_point: chosenClaim?.pain_point ?? '',
          video_format: chosenClaim?.video_format ?? '',
          promise_structure: chosenClaim?.promise_structure ?? '',
          viewer_transformation: chosenClaim?.viewer_transformation ?? '',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setNotionUrl(data.notionUrl ?? null);
      setStage('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save to Notion');
      setStage('select-title');
    }
  }, [script, chosenClaim, chosenHook, chosenThumbnail, titles]);

  const reset = useCallback(() => {
    setStage('script');
    setScript('');
    setError(null);
    setClaims([]);
    setChosenClaim(null);
    setHooks([]);
    setChosenHook(null);
    setThumbnailTexts([]);
    setChosenThumbnail(null);
    setTitles([]);
    setChosenTitle(null);
    setIntros([]);
    setChosenIntro(null);
    setNotionUrl(null);
    setPipelineComplete(null);
    setExpandedBriefId(null);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-lg font-semibold tracking-tight text-white">YT Pipeline</h1>
          <p className="text-sm text-zinc-600">claim · hook · intro · thumbnail · title</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── Stage: Script Input ── */}
        {stage === 'script' && (
          <div>
            <SectionHeader
              step={1} total={6}
              title="Paste your script"
              subtitle="The full transcript or draft script for this video."
            />
            <textarea
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-sm leading-relaxed text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-0"
              rows={16}
              placeholder="Paste your video script or transcript here…"
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />
            <button
              onClick={generateClaims}
              disabled={!script.trim()}
              className="mt-4 rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Generate Claims →
            </button>
          </div>
        )}

        {/* ── Stage: Loading Claims ── */}
        {stage === 'loading-claims' && <TensionTriangleProgress stage="claim" isComplete={pipelineComplete === 'claim'} />}

        {/* ── Stage: Select Claim ── */}
        {stage === 'select-claim' && (
          <div>
            <SectionHeader
              step={2} total={6}
              title="Select the core claim"
              subtitle="Pick the angle that best captures what this video argues."
            />
            <div className="flex flex-col gap-3">
              {claims.map((c) => {
                const isExpanded = expandedBriefId === c.id;
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 transition-all hover:border-orange-500/60 hover:bg-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-relaxed text-white">
                        {c.claim}
                      </p>
                      {c.video_format && (
                        <span className="shrink-0 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/20">
                          {c.video_format}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">{c.angle}</p>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                        <BriefField label="Target audience" value={c.target_audience} />
                        <BriefField label="Pain point" value={c.pain_point} />
                        <BriefField label="Promise" value={c.promise_structure} />
                        <BriefField label="Viewer transformation" value={c.viewer_transformation} />
                        <BriefField label="Why this brief" value={c.whyThisIsTheBrief} />
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <button
                        onClick={() => setExpandedBriefId(isExpanded ? null : c.id)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {isExpanded ? 'Hide brief ▴' : 'Show brief ▾'}
                      </button>
                      <button
                        onClick={() => selectClaim(c)}
                        className="rounded-lg bg-orange-500/10 px-4 py-1.5 text-xs font-medium text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
                      >
                        Select →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stage: Loading Hooks ── */}
        {stage === 'loading-hooks' && <TensionTriangleProgress stage="hook" isComplete={pipelineComplete === 'hook'} />}

        {/* ── Stage: Select Hook ── */}
        {stage === 'select-hook' && (
          <div>
            {chosenClaim && (
              <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-600">Selected claim</p>
                    <p className="mt-0.5 text-sm text-zinc-300">{chosenClaim.claim}</p>
                  </div>
                  {chosenClaim.video_format && (
                    <span className="shrink-0 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/20">
                      {chosenClaim.video_format}
                    </span>
                  )}
                </div>
                {chosenClaim.pain_point && (
                  <p className="mt-1.5 text-xs text-zinc-500"><span className="text-zinc-600 font-medium">Pain point:</span> {chosenClaim.pain_point}</p>
                )}
              </div>
            )}
            <SectionHeader
              step={3} total={6}
              title="Select a hook"
              subtitle="The opening line Josh speaks in the first 10 seconds."
            />
            <div className="flex flex-col gap-3">
              {hooks.map((h, i) => (
                <button
                  key={i}
                  onClick={() => selectHook(h)}
                  className="group rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-left transition-all hover:border-orange-500/60 hover:bg-zinc-800"
                >
                  <p className="text-sm leading-relaxed text-white group-hover:text-orange-400">{h.text}</p>
                  <p className="mt-1 text-xs text-zinc-600">{h.mechanism}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Stage: Loading Intros ── */}
        {stage === 'loading-intros' && <Spinner label="Generating intro suggestions…" />}

        {/* ── Stage: Select Intro ── */}
        {stage === 'select-intro' && (
          <div>
            <div className="mb-6 space-y-2">
              <SelectionPill label="Claim" value={chosenClaim?.claim ?? ''} />
              <SelectionPill label="Hook" value={chosenHook?.text ?? ''} />
            </div>
            <SectionHeader
              step={4} total={6}
              title="Select an intro"
              subtitle="How Josh establishes credibility for this specific topic. Optional — skip if none fit."
            />
            <div className="flex flex-col gap-3">
              {intros.map((intro) => (
                <div
                  key={intro.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 transition-all hover:border-orange-500/60 hover:bg-zinc-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-relaxed text-white">{intro.text}</p>
                    <span className="shrink-0 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/20">
                      {intro.credibility_angle}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{intro.why_this_works}</p>
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => selectIntro(intro)}
                      className="rounded-lg bg-orange-500/10 px-4 py-1.5 text-xs font-medium text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
                    >
                      Select →
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={skipIntro}
              className="mt-4 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Skip intro →
            </button>
          </div>
        )}

        {/* ── Stage: Loading Thumbnails ── */}
        {stage === 'loading-thumbnails' && <TensionTriangleProgress stage="thumbnail" isComplete={pipelineComplete === 'thumbnail'} />}

        {/* ── Stage: Select Thumbnail ── */}
        {stage === 'select-thumbnail' && (
          <div>
            <div className="mb-6 space-y-2">
              <SelectionPill label="Claim" value={chosenClaim?.claim ?? ''} />
              <SelectionPill label="Hook" value={chosenHook?.text ?? ''} />
              {chosenIntro && <SelectionPill label="Intro" value={chosenIntro.text} />}
              {(chosenClaim?.video_format || chosenClaim?.pain_point) && (
                <div className="flex items-center gap-2 px-1 pt-1">
                  {chosenClaim?.video_format && (
                    <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/20">
                      {chosenClaim.video_format}
                    </span>
                  )}
                  {chosenClaim?.pain_point && (
                    <span className="text-xs text-zinc-500 truncate">{chosenClaim.pain_point}</span>
                  )}
                </div>
              )}
            </div>
            <SectionHeader
              step={5} total={6}
              title="Select thumbnail text"
              subtitle="2–5 words that appear on the thumbnail image."
            />
            <div className="grid grid-cols-2 gap-3">
              {thumbnailTexts.map((t, i) => (
                <button
                  key={i}
                  onClick={() => selectThumbnail(t)}
                  className="group rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-left transition-all hover:border-orange-500/60 hover:bg-zinc-800"
                >
                  <p className="text-base font-semibold uppercase tracking-wide text-white group-hover:text-orange-400">
                    {t.text}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">{t.visual_concept}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Stage: Loading Titles ── */}
        {stage === 'loading-titles' && <TensionTriangleProgress stage="title" isComplete={pipelineComplete === 'title'} />}

        {/* ── Stage: Select Title ── */}
        {stage === 'select-title' && (
          <div>
            <div className="mb-8 space-y-2">
              <SelectionPill label="Claim" value={chosenClaim?.claim ?? ''} />
              <SelectionPill label="Hook" value={chosenHook?.text ?? ''} />
              <SelectionPill label="Thumbnail" value={chosenThumbnail?.text ?? ''} />
              {chosenIntro && <SelectionPill label="Intro" value={chosenIntro.text} />}
              {(chosenClaim?.video_format || chosenClaim?.pain_point) && (
                <div className="flex items-center gap-2 px-1 pt-1">
                  {chosenClaim?.video_format && (
                    <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/20">
                      {chosenClaim.video_format}
                    </span>
                  )}
                  {chosenClaim?.pain_point && (
                    <span className="text-xs text-zinc-500 truncate">{chosenClaim.pain_point}</span>
                  )}
                </div>
              )}
            </div>
            <SectionHeader
              step={6} total={6}
              title="Select a title"
              subtitle="All titles are under 60 characters. Pick the best one."
            />
            <div className="flex flex-col gap-3">
              {titles.map((t, i) => (
                <button
                  key={i}
                  onClick={() => selectTitle(t)}
                  className="group rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-left transition-all hover:border-orange-500/60 hover:bg-zinc-800"
                >
                  <p className="text-sm font-medium text-white group-hover:text-orange-400">{t.text}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-xs text-zinc-600">{t.character_count} chars</span>
                    <span className="text-xs text-zinc-700">·</span>
                    <span className="text-xs text-zinc-600">{t.formula}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Stage: Saving ── */}
        {stage === 'saving' && <Spinner label="Saving to Notion…" />}

        {/* ── Stage: Done ── */}
        {stage === 'done' && (
          <div>
            <div className="mb-8">
              <p className="mb-1 text-xs font-medium uppercase tracking-widest text-orange-500">Complete</p>
              <h2 className="text-2xl font-semibold text-white">Pipeline done</h2>
              {notionUrl && (
                <a
                  href={notionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-sm text-zinc-500 underline hover:text-zinc-300"
                >
                  View in Notion →
                </a>
              )}
            </div>
            <div className="space-y-4">
              <ResultCard label="Claim" value={chosenClaim?.claim ?? ''} />
              {chosenClaim && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
                  <p className="text-xs font-medium text-zinc-600 mb-3">Video Brief</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {chosenClaim.video_format && (
                      <div className="text-xs">
                        <span className="text-zinc-600 font-medium">Format</span>
                        <p className="text-zinc-300 mt-0.5">{chosenClaim.video_format}</p>
                      </div>
                    )}
                    {chosenClaim.target_audience && (
                      <div className="text-xs">
                        <span className="text-zinc-600 font-medium">Target audience</span>
                        <p className="text-zinc-300 mt-0.5">{chosenClaim.target_audience}</p>
                      </div>
                    )}
                    {chosenClaim.pain_point && (
                      <div className="text-xs">
                        <span className="text-zinc-600 font-medium">Pain point</span>
                        <p className="text-zinc-300 mt-0.5">{chosenClaim.pain_point}</p>
                      </div>
                    )}
                    {chosenClaim.promise_structure && (
                      <div className="text-xs">
                        <span className="text-zinc-600 font-medium">Promise</span>
                        <p className="text-zinc-300 mt-0.5">{chosenClaim.promise_structure}</p>
                      </div>
                    )}
                    {chosenClaim.viewer_transformation && (
                      <div className="text-xs col-span-2">
                        <span className="text-zinc-600 font-medium">Viewer transformation</span>
                        <p className="text-zinc-300 mt-0.5">{chosenClaim.viewer_transformation}</p>
                      </div>
                    )}
                    {chosenClaim.angle && (
                      <div className="text-xs col-span-2">
                        <span className="text-zinc-600 font-medium">Angle</span>
                        <p className="text-zinc-300 mt-0.5">{chosenClaim.angle}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <ResultCard label="Hook" value={chosenHook?.text ?? ''} />
              {chosenIntro && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-xs font-medium text-zinc-600">Intro</p>
                    <span className="shrink-0 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/20">
                      {chosenIntro.credibility_angle}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-200">{chosenIntro.text}</p>
                </div>
              )}
              <ResultCard label="Thumbnail Text" value={chosenThumbnail?.text ?? ''} />
              <ResultCard label="Title" value={chosenTitle?.text ?? ''} highlight />
            </div>
            <button
              onClick={reset}
              className="mt-10 rounded-lg border border-zinc-800 px-6 py-3 text-sm text-zinc-400 transition-all hover:border-zinc-600 hover:text-white"
            >
              Start new video
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
