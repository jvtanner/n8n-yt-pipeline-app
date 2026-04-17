'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TensionTriangleProgress from './TensionTriangleProgress';
import { saveRun } from '@/lib/history';
import { saveSession, loadSession, clearSession } from '@/lib/session';
import VoiceProfileSideQuest from '@/components/VoiceProfileSideQuest';
import ThumbnailImageStudio from '@/components/ThumbnailImageStudio';
import { copyToClipboard, formatBriefForCopy } from '@/lib/clipboard';
import IconButton from '@/components/IconButton';
import { saveToIdeaBank, removeFromIdeaBank, isInIdeaBank, loadIdeaBank, type SavedItem } from '@/lib/ideaBank';
import { useUser } from '@/lib/useUser';

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;

const WORKFLOW_IDS: Record<string, string> = {
  'yt-claim-gen': process.env.NEXT_PUBLIC_WF_CLAIM_GEN || 'uCBzCUOuMC5lKW8R',
  'yt-hook-gen': process.env.NEXT_PUBLIC_WF_HOOK_GEN || 'mrhxcmny0K52ftcv',
  'yt-intro-gen': process.env.NEXT_PUBLIC_WF_INTRO_GEN || 'eOGpGx2A7qc2AFYq',
  'yt-thumbnail-gen': process.env.NEXT_PUBLIC_WF_THUMBNAIL_GEN || 'XjKDQq34UP92tUJG',
  'yt-title-gen': process.env.NEXT_PUBLIC_WF_TITLE_GEN || '8SFhgEtcea30bqgu',
  'yt-thumbnail-image-gen': process.env.NEXT_PUBLIC_WF_THUMBNAIL_IMAGE_GEN || 'nTA0DgdesN7hsoUy',
  'yt-save-to-notion-v2': 'Qry3Z7ixCjnQZ8wJ',
};

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
  score?: number | null;
}

interface Hook {
  text: string;
  mechanism: string;
  information_gap: string;
  cold_viewer_check: string;
  score?: number | null;
}

interface ThumbnailText {
  text: string;
  word_count: number;
  visual_concept: string;
  title_complement: string;
  score?: number | null;
}

interface Title {
  text: string;
  character_count: number;
  formula: string;
  primary_keyword: string;
  thumbnail_complement: string;
  score?: number | null;
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
  | 'thumbnail-image'
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

function PencilButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`shrink-0 p-1 rounded transition-colors ${active ? 'text-orange-400' : 'text-zinc-600 hover:text-zinc-400'}`}
      title="Edit text"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function pollForResult(
  workflowId: string,
  startedAfter: string,
  timeoutMs = 300000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  // Wait before first poll so the execution has time to appear in the API
  await new Promise(r => setTimeout(r, 8000));

  while (Date.now() < deadline) {
    const res = await fetch(
      `/api/poll?workflowId=${workflowId}&startedAfter=${encodeURIComponent(startedAfter)}`,
    );
    if (!res.ok) throw new Error('Poll request failed');
    const result = await res.json();

    if (result.status === 'complete') return result.data;
    if (result.status === 'error') throw new Error(result.message || 'Execution failed');

    // 'waiting' or 'running' — keep polling
    await new Promise(r => setTimeout(r, 5000));
  }

  throw new Error('Pipeline timed out — please try again');
}

async function fetchWithPolling(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!N8N_BASE) {
    throw new Error('N8N webhook URL not configured. Set NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL.');
  }

  const workflowId = WORKFLOW_IDS[endpoint];
  const startedAfter = new Date().toISOString();

  // Fire the webhook request (triggers the n8n execution)
  const directPromise: Promise<Record<string, unknown>> = fetch(`${N8N_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => {
    if (res.ok) {
      // n8n returns 200 + empty body when responseMode=responseNode and the
      // Respond node never fires (e.g. an upstream node errored). res.json()
      // would throw a confusing SyntaxError; surface a real error instead so
      // the catch path runs and the retry UI shows.
      const text = await res.text();
      if (!text) throw new Error('Workflow returned empty response — execution likely errored before completing');
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error('Workflow returned invalid JSON: ' + text.slice(0, 200));
      }
    }
    // On Cloudflare 524 or proxy timeout, return a never-resolving promise
    // so polling can win via Promise.any()
    if (res.status === 524 || res.status === 502 || res.status === 504) {
      return new Promise<Record<string, unknown>>(() => {});
    }
    throw new Error(await res.text());
  });

  // If no workflow ID mapping (e.g., save-to-notion), use direct only
  if (!workflowId) return directPromise;

  // Race: direct response vs. polling fallback
  const pollingPromise = pollForResult(workflowId, startedAfter);
  return Promise.any([directPromise, pollingPromise]);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PipelinePage() {
  const router = useRouter();
  const { user, isGuest, loading: userLoading } = useUser();
  const creatorName = user?.creatorName || user?.email || '';
  const [stage, setStage] = useState<Stage>('script');
  const [script, setScript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [retryPayload, setRetryPayload] = useState<{ fn: string; args: unknown[] } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;

    // Authenticated users always have access
    // Guests get one free run — if already used, redirect to login
    if (isGuest) {
      const freeRunUsed = localStorage.getItem('ytPipelineFreeRunUsed') === 'true';
      if (freeRunUsed) {
        router.replace('/');
        return;
      }
    }

    if (user) {
      setHasProfile(!!user.voiceProfile);
    } else {
      // Guest — check localStorage for profile
      const name = localStorage.getItem('ytPipelineCreator');
      setHasProfile(!!name && !!localStorage.getItem('ytPipelineProfile:' + name));
    }
    setSideQuestDismissed(!!localStorage.getItem('ytPipelineSideQuestDismissed'));

    // Restore session if one exists
    const savedSession = loadSession();
    if (savedSession) {
      setStage(savedSession.stage as Stage);
      setScript(savedSession.script);
      setClaims(savedSession.claims as Claim[]);
      setChosenClaim(savedSession.chosenClaim as Claim | null);
      setHooks(savedSession.hooks as Hook[]);
      setChosenHook(savedSession.chosenHook as Hook | null);
      setIntros(savedSession.intros as Intro[]);
      setChosenIntro(savedSession.chosenIntro as Intro | null);
      setThumbnailTexts(savedSession.thumbnailTexts as ThumbnailText[]);
      setChosenThumbnail(savedSession.chosenThumbnail as ThumbnailText | null);
      setThumbnailImageUrl(savedSession.thumbnailImageUrl);
      setTitles(savedSession.titles as Title[]);
      setChosenTitle(savedSession.chosenTitle as Title | null);
    }
  }, [router, userLoading, isGuest, user]);

  const [claims, setClaims] = useState<Claim[]>([]);
  const [chosenClaim, setChosenClaim] = useState<Claim | null>(null);

  const [hooks, setHooks] = useState<Hook[]>([]);
  const [chosenHook, setChosenHook] = useState<Hook | null>(null);

  const [thumbnailTexts, setThumbnailTexts] = useState<ThumbnailText[]>([]);
  const [chosenThumbnail, setChosenThumbnail] = useState<ThumbnailText | null>(null);
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState<string | null>(null);

  const [titles, setTitles] = useState<Title[]>([]);
  const [chosenTitle, setChosenTitle] = useState<Title | null>(null);

  const [intros, setIntros] = useState<Intro[]>([]);
  const [chosenIntro, setChosenIntro] = useState<Intro | null>(null);

  const [notionUrl, setNotionUrl] = useState<string | null>(null);
  const [pipelineComplete, setPipelineComplete] = useState<'claim' | 'hook' | 'thumbnail' | 'title' | null>(null);
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);

  // ── Inline edit state ────────────────────────────────────────────────────
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Done-screen editing state ───────────────────────────────────────────
  const [doneEditing, setDoneEditing] = useState<string | null>(null);
  const [doneEditText, setDoneEditText] = useState('');
  const [thumbnailStudioOpen, setThumbnailStudioOpen] = useState(false);

  // ── Credential input state ───────────────────────────────────────────────
  const [newCredential, setNewCredential] = useState('');
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [credentialSaved, setCredentialSaved] = useState(false);
  const [showCredentialInput, setShowCredentialInput] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [sideQuestDismissed, setSideQuestDismissed] = useState(false);
  const [ideaBankVersion, setIdeaBankVersion] = useState(0);

  useEffect(() => {
    if (stage === 'script' && !script) return; // Don't save empty initial state
    saveSession({
      stage, script, creatorName,
      claims, chosenClaim,
      hooks, chosenHook,
      intros, chosenIntro,
      thumbnailTexts, chosenThumbnail, thumbnailImageUrl,
      titles, chosenTitle,
    });
  }, [stage, script, creatorName, claims, chosenClaim, hooks, chosenHook, intros, chosenIntro, thumbnailTexts, chosenThumbnail, thumbnailImageUrl, titles, chosenTitle]);

  const toggleEdit = (id: string, originalText: string) => {
    if (editingId === id) {
      setEditingId(null);
    } else {
      setEditingId(id);
      if (!(id in editedTexts)) {
        setEditedTexts(prev => ({ ...prev, [id]: originalText }));
      }
    }
  };

  const updateEditedText = (id: string, text: string) => {
    setEditedTexts(prev => ({ ...prev, [id]: text }));
  };

  const getDisplayText = (id: string, originalText: string) => {
    return editedTexts[id] ?? originalText;
  };

  const toggleIdeaBank = (type: SavedItem['type'], text: string, metadata: Record<string, string>) => {
    if (isInIdeaBank(type, text)) {
      const bank = loadIdeaBank();
      const item = bank.find(i => i.type === type && i.text === text);
      if (item) removeFromIdeaBank(item.id);
    } else {
      saveToIdeaBank({ type, text, metadata, savedFrom: script.slice(0, 100) });
    }
    setIdeaBankVersion(v => v + 1);
  };

  // ── API calls ────────────────────────────────────────────────────────────

  const generateClaims = useCallback(async () => {
    if (!script.trim()) return;
    setError(null);
    setStage('loading-claims');
    setPipelineComplete(null);
    try {
      const data = await fetchWithPolling('yt-claim-gen', { rawIdea: script.trim(), creatorName });
      const claimsArray: Claim[] = (data.claims as Claim[]) ?? [];
      if (!claimsArray.length) throw new Error('No claims returned');
      setRetryCount(0);
      setRetryPayload(null);
      setRetryError(null);
      setClaims(claimsArray);
      setPipelineComplete('claim');
      await new Promise(r => setTimeout(r, 700));
      setStage('select-claim');
      setPipelineComplete(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate claims';
      setRetryError(msg);
      setRetryCount(prev => prev + 1);
      setRetryPayload({ fn: 'generateClaims', args: [] });
    }
  }, [script, creatorName]);

  const selectClaim = useCallback(async (claim: Claim, overrideText?: string) => {
    const claimText = overrideText ?? claim.claim;
    setChosenClaim({ ...claim, claim: claimText });
    setError(null);
    setStage('loading-hooks');
    setPipelineComplete(null);
    setEditingId(null);
    try {
      const data = await fetchWithPolling('yt-hook-gen', {
        rawIdea: script.trim(),
        claim: claimText,
        creatorName,
        target_audience: claim.target_audience || '',
        pain_point: claim.pain_point || '',
        video_format: claim.video_format || '',
        promise_structure: claim.promise_structure || '',
        viewer_transformation: claim.viewer_transformation || '',
      });
      const hooksArray: Hook[] = (data.hooks as Hook[]) ?? [];
      if (!hooksArray.length) throw new Error('No hooks returned');
      setRetryCount(0);
      setRetryPayload(null);
      setRetryError(null);
      setHooks(hooksArray);
      setPipelineComplete('hook');
      await new Promise(r => setTimeout(r, 700));
      setStage('select-hook');
      setPipelineComplete(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate hooks';
      setRetryError(msg);
      setRetryCount(prev => prev + 1);
      setRetryPayload({ fn: 'selectClaim', args: [] });
    }
  }, [script, creatorName]);

  const selectHook = useCallback(async (hook: Hook, overrideText?: string) => {
    const hookText = overrideText ?? hook.text;
    setChosenHook({ ...hook, text: hookText });
    setError(null);
    setStage('loading-intros');
    setEditingId(null);
    try {
      const data = await fetchWithPolling('yt-intro-gen', {
        rawIdea: script.trim(),
        claim: chosenClaim!.claim,
        chosenHook: hookText,
        creatorName,
        target_audience: chosenClaim!.target_audience || '',
        pain_point: chosenClaim!.pain_point || '',
        video_format: chosenClaim!.video_format || '',
      });
      const introsArray: Intro[] = (data.intros as Intro[]) ?? [];
      if (!introsArray.length) throw new Error('No intros returned');
      setRetryCount(0);
      setRetryPayload(null);
      setRetryError(null);
      setIntros(introsArray);
      setStage('select-intro');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate intros';
      setRetryError(msg);
      setRetryCount(prev => prev + 1);
      setRetryPayload({ fn: 'selectHook', args: [] });
    }
  }, [script, chosenClaim, creatorName]);

  const selectIntro = useCallback(async (intro: Intro, overrideText?: string) => {
    const introText = overrideText ?? intro.text;
    setChosenIntro({ ...intro, text: introText });
    setError(null);
    setStage('loading-thumbnails');
    setPipelineComplete(null);
    setEditingId(null);
    try {
      const data = await fetchWithPolling('yt-thumbnail-gen', {
        rawIdea: script.trim(),
        claim: chosenClaim!.claim,
        chosenHook: chosenHook!.text,
        creatorName,
        target_audience: chosenClaim!.target_audience || '',
        pain_point: chosenClaim!.pain_point || '',
        video_format: chosenClaim!.video_format || '',
        promise_structure: chosenClaim!.promise_structure || '',
        viewer_transformation: chosenClaim!.viewer_transformation || '',
      });
      const thumbsArray: ThumbnailText[] = (data.thumbnail_texts as ThumbnailText[]) ?? [];
      if (!thumbsArray.length) throw new Error('No thumbnail texts returned');
      setRetryCount(0);
      setRetryPayload(null);
      setRetryError(null);
      setThumbnailTexts(thumbsArray);
      setPipelineComplete('thumbnail');
      await new Promise(r => setTimeout(r, 700));
      setStage('select-thumbnail');
      setPipelineComplete(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate thumbnail texts';
      setRetryError(msg);
      setRetryCount(prev => prev + 1);
      setRetryPayload({ fn: 'selectIntro', args: [] });
    }
  }, [script, chosenClaim, chosenHook, creatorName]);

  const skipIntro = useCallback(async () => {
    setChosenIntro(null);
    setError(null);
    setStage('loading-thumbnails');
    setPipelineComplete(null);
    setEditingId(null);
    try {
      const data = await fetchWithPolling('yt-thumbnail-gen', {
        rawIdea: script.trim(),
        claim: chosenClaim!.claim,
        chosenHook: chosenHook!.text,
        creatorName,
        target_audience: chosenClaim!.target_audience || '',
        pain_point: chosenClaim!.pain_point || '',
        video_format: chosenClaim!.video_format || '',
        promise_structure: chosenClaim!.promise_structure || '',
        viewer_transformation: chosenClaim!.viewer_transformation || '',
      });
      const thumbsArray: ThumbnailText[] = (data.thumbnail_texts as ThumbnailText[]) ?? [];
      if (!thumbsArray.length) throw new Error('No thumbnail texts returned');
      setRetryCount(0);
      setRetryPayload(null);
      setRetryError(null);
      setThumbnailTexts(thumbsArray);
      setPipelineComplete('thumbnail');
      await new Promise(r => setTimeout(r, 700));
      setStage('select-thumbnail');
      setPipelineComplete(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate thumbnail texts';
      setRetryError(msg);
      setRetryCount(prev => prev + 1);
      setRetryPayload({ fn: 'skipIntro', args: [] });
    }
  }, [script, chosenClaim, chosenHook, creatorName]);

  const loadTitles = useCallback(async (thumbText: string) => {
    setError(null);
    setStage('loading-titles');
    setPipelineComplete(null);
    setEditingId(null);
    try {
      const data = await fetchWithPolling('yt-title-gen', {
        rawIdea: script.trim(),
        claim: chosenClaim!.claim,
        chosenHook: chosenHook!.text,
        chosenThumbnailText: thumbText,
        creatorName,
        target_audience: chosenClaim!.target_audience || '',
        pain_point: chosenClaim!.pain_point || '',
        video_format: chosenClaim!.video_format || '',
        promise_structure: chosenClaim!.promise_structure || '',
        viewer_transformation: chosenClaim!.viewer_transformation || '',
      });
      const titlesArray: Title[] = (data.titles as Title[]) ?? [];
      if (!titlesArray.length) throw new Error('No titles returned');
      setRetryCount(0);
      setRetryPayload(null);
      setRetryError(null);
      setTitles(titlesArray);
      setPipelineComplete('title');
      await new Promise(r => setTimeout(r, 700));
      setStage('select-title');
      setPipelineComplete(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate titles';
      setRetryError(msg);
      setRetryCount(prev => prev + 1);
      setRetryPayload({ fn: 'loadTitles', args: [] });
    }
  }, [script, chosenClaim, chosenHook, creatorName]);

  const selectThumbnail = useCallback((thumb: ThumbnailText, overrideText?: string) => {
    const thumbText = overrideText ?? thumb.text;
    setChosenThumbnail({ ...thumb, text: thumbText });
    setError(null);
    setEditingId(null);
    loadTitles(thumbText);
  }, [loadTitles]);

  const selectTitle = useCallback(async (title: Title, overrideText?: string) => {
    const titleText = overrideText ?? title.text;
    setChosenTitle({ ...title, text: titleText });
    setStage('saving');
    setError(null);
    setEditingId(null);
    try {
      const data = await fetchWithPolling('yt-save-to-notion-v2', {
        rawIdea: script.trim(),
        chosenClaim: chosenClaim?.claim ?? '',
        chosenHook: chosenHook?.text ?? '',
        chosenIntro: chosenIntro?.text ?? '',
        chosenIntroAngle: chosenIntro?.credibility_angle ?? '',
        chosenThumbnailText: chosenThumbnail?.text ?? '',
        thumbnailImageUrl: thumbnailImageUrl ?? '',
        chosenTitle: titleText,
        creatorName,
        claimOptions: claims.map((c, i) => `${i + 1}. ${c.claim}`).join('\n').slice(0, 2000),
        hookOptions: hooks.map((h, i) => `${i + 1}. ${h.text}`).join('\n').slice(0, 2000),
        thumbnailOptions: thumbnailTexts.map((t, i) => `${i + 1}. ${t.text}`).join('\n').slice(0, 2000),
        titleOptions: titles.map((t, i) => `${i + 1}. ${t.text}`).join('\n').slice(0, 2000),
        target_audience: chosenClaim?.target_audience ?? '',
        pain_point: chosenClaim?.pain_point ?? '',
        video_format: chosenClaim?.video_format ?? '',
        promise_structure: chosenClaim?.promise_structure ?? '',
        viewer_transformation: chosenClaim?.viewer_transformation ?? '',
      });
      setNotionUrl((data.notionUrl as string) ?? null);
      saveRun({
        creatorName,
        rawIdea: script.trim(),
        chosenClaim: chosenClaim?.claim ?? '',
        chosenHook: chosenHook?.text ?? '',
        chosenIntro: chosenIntro?.text,
        chosenThumbnailText: chosenThumbnail?.text ?? '',
        thumbnailImageUrl: thumbnailImageUrl ?? '',
        chosenTitle: titleText,
        videoBrief: {
          target_audience: chosenClaim?.target_audience,
          pain_point: chosenClaim?.pain_point,
          video_format: chosenClaim?.video_format,
        },
      });
      // Save to server-side runs DB for authenticated users (fire-and-forget)
      if (!isGuest) {
        fetch('/api/user/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorName,
            rawIdea: script.trim(),
            chosenClaim: chosenClaim?.claim ?? '',
            chosenHook: chosenHook?.text ?? '',
            chosenIntro: chosenIntro?.text,
            chosenThumbnailText: chosenThumbnail?.text ?? '',
            chosenTitle: titleText,
            thumbnailImageUrl: thumbnailImageUrl ?? undefined,
          }),
        }).catch(() => {}); // Non-critical — n8n save is primary
      }
      localStorage.setItem('ytPipelineFreeRunUsed', 'true');
      setRetryCount(0);
      setRetryPayload(null);
      setRetryError(null);
      clearSession();
      setStage('done');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save to Notion';
      setRetryError(msg);
      setRetryCount(prev => prev + 1);
      setRetryPayload({ fn: 'selectTitle', args: [] });
    }
  }, [script, chosenClaim, chosenHook, chosenIntro, chosenThumbnail, thumbnailImageUrl, titles, claims, hooks, thumbnailTexts, creatorName]);

  const saveCredential = useCallback(async () => {
    if (!newCredential.trim() || !N8N_BASE) return;
    setCredentialSaving(true);
    try {
      await fetch(`${N8N_BASE}/yt-append-credential`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorName, newCredential: newCredential.trim() }),
      });
      setCredentialSaved(true);
      setNewCredential('');
      setTimeout(() => {
        setCredentialSaved(false);
        setShowCredentialInput(false);
      }, 3000);
    } catch {
      setError('Failed to save credential');
    } finally {
      setCredentialSaving(false);
    }
  }, [newCredential, creatorName]);

  const reset = useCallback(() => {
    clearSession();
    // Guests who've used their free run get redirected to sign up
    if (isGuest) {
      const freeRunUsed = localStorage.getItem('ytPipelineFreeRunUsed') === 'true';
      if (freeRunUsed) {
        router.replace('/');
        return;
      }
    }
    setStage('script');
    setScript('');
    setError(null);
    setRetryCount(0);
    setRetryPayload(null);
    setRetryError(null);
    setClaims([]);
    setChosenClaim(null);
    setHooks([]);
    setChosenHook(null);
    setThumbnailTexts([]);
    setChosenThumbnail(null);
    setThumbnailImageUrl(null);
    setTitles([]);
    setChosenTitle(null);
    setIntros([]);
    setChosenIntro(null);
    setNotionUrl(null);
    setPipelineComplete(null);
    setExpandedBriefId(null);
    setEditedTexts({});
    setEditingId(null);
    setNewCredential('');
    setCredentialSaving(false);
    setCredentialSaved(false);
    setShowCredentialInput(false);
    setDoneEditing(null);
    setDoneEditText('');
    setThumbnailStudioOpen(false);
  }, [isGuest, router]);

  // ── Back navigation ──────────────────────────────────────────────────
  const goBack = useCallback(() => {
    const backMap: Partial<Record<Stage, Stage>> = {
      'select-claim': 'script',
      'select-hook': 'select-claim',
      'select-intro': 'select-hook',
      'select-thumbnail': chosenIntro ? 'select-intro' : 'select-hook',
      'select-title': 'select-thumbnail',
      'done': 'select-title',
    };

    const prev = backMap[stage];
    if (!prev) return false; // No back target (script, loading, saving)

    // Clear data for the stage we're leaving
    if (stage === 'select-claim') { setClaims([]); setChosenClaim(null); }
    if (stage === 'select-hook') { setHooks([]); setChosenHook(null); }
    if (stage === 'select-intro') { setIntros([]); setChosenIntro(null); }
    if (stage === 'select-thumbnail') { setThumbnailTexts([]); setChosenThumbnail(null); setThumbnailImageUrl(null); }
    if (stage === 'select-title') { setTitles([]); setChosenTitle(null); }
    if (stage === 'done') { setNotionUrl(null); setPipelineComplete(null); setDoneEditing(null); setDoneEditText(''); setThumbnailStudioOpen(false); }

    setError(null);
    setRetryError(null);
    setRetryPayload(null);
    setRetryCount(0);
    setStage(prev);
    return true;
  }, [stage, chosenIntro]);

  // Push browser history on each selection stage
  useEffect(() => {
    const selectionStages: Stage[] = ['select-claim', 'select-hook', 'select-intro', 'select-thumbnail', 'select-title', 'done'];
    if (selectionStages.includes(stage)) {
      window.history.pushState({ stage }, '', '/pipeline');
    }
  }, [stage]);

  // Intercept browser back button
  useEffect(() => {
    const handlePopState = () => {
      const went = goBack();
      if (!went) {
        // No back target — let browser navigate normally (to dashboard)
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [goBack]);

  const canGoBack = ['select-claim', 'select-hook', 'select-intro', 'select-thumbnail', 'select-title', 'done'].includes(stage);

  const handleRetry = useCallback(() => {
    if (!retryPayload) return;
    setRetryError(null);
    const { fn } = retryPayload;
    if (fn === 'generateClaims') generateClaims();
    else if (fn === 'selectClaim' && chosenClaim) selectClaim(chosenClaim);
    else if (fn === 'selectHook' && chosenHook) selectHook(chosenHook);
    else if (fn === 'selectIntro' && chosenIntro) selectIntro(chosenIntro);
    else if (fn === 'skipIntro') skipIntro();
    else if (fn === 'loadTitles' && chosenThumbnail) loadTitles(chosenThumbnail.text);
    else if (fn === 'selectTitle' && chosenTitle) selectTitle(chosenTitle);
  }, [retryPayload, generateClaims, selectClaim, selectHook, selectIntro, skipIntro, loadTitles, selectTitle, chosenClaim, chosenHook, chosenIntro, chosenThumbnail, chosenTitle]);

  const handleRetryFallback = useCallback(() => {
    setRetryError(null);
    setRetryCount(0);
    setRetryPayload(null);
    const fallbackMap: Record<string, string> = {
      'loading-claims': 'script',
      'loading-hooks': 'select-claim',
      'loading-intros': 'select-hook',
      'loading-thumbnails': 'select-intro',
      'thumbnail-image': 'select-thumbnail',
      'loading-titles': 'select-thumbnail',
      'saving': 'select-title',
    };
    setStage((fallbackMap[stage] || 'script') as Stage);
  }, [stage]);

  // ── Done-screen edit handlers ─────────────────────────────────────────
  const startDoneEdit = (field: string, currentText: string) => {
    setDoneEditing(field);
    setDoneEditText(currentText);
  };

  const saveDoneEdit = () => {
    if (!doneEditing) return;
    if (doneEditing === 'title' && chosenTitle) setChosenTitle({ ...chosenTitle, text: doneEditText });
    else if (doneEditing === 'hook' && chosenHook) setChosenHook({ ...chosenHook, text: doneEditText });
    else if (doneEditing === 'intro' && chosenIntro) setChosenIntro({ ...chosenIntro, text: doneEditText });
    else if (doneEditing === 'claim' && chosenClaim) setChosenClaim({ ...chosenClaim, claim: doneEditText });
    else if (doneEditing === 'thumbnailText' && chosenThumbnail) setChosenThumbnail({ ...chosenThumbnail, text: doneEditText });
    setDoneEditing(null);
  };

  const cancelDoneEdit = () => {
    setDoneEditing(null);
    setDoneEditText('');
  };

  // ── Render ───────────────────────────────────────────────────────────────

  function CopyButton({ text, size = 13 }: { text: string; size?: number }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
      const ok = await copyToClipboard(text);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    };
    return (
      <IconButton
        icon={copied ? 'check' : 'copy'}
        onClick={handleCopy}
        title={copied ? 'Copied' : 'Copy'}
        size={size}
        active={copied}
      />
    );
  }

  if (userLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3">
            {canGoBack && (
              <button
                onClick={goBack}
                className="rounded-lg border border-zinc-800 p-2 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-all"
                title="Go back"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">YouTube AI Team</h1>
              <p className="text-sm text-zinc-600">Your AI specialists for claims, hooks, intros, thumbnails, and titles</p>
            </div>
          </div>
          {creatorName && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-zinc-600">Profile:</span>
              <span className="text-xs text-orange-400 font-medium">{creatorName}</span>
              {isGuest && <span className="text-xs text-zinc-700">(free run)</span>}
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── Voice Profile (required) ── */}
        {stage === 'script' && !hasProfile && (
          <div className="mb-6">
            <VoiceProfileSideQuest
              creatorName={creatorName}
              onComplete={() => setHasProfile(true)}
            />
          </div>
        )}

        {/* ── Stage: Script Input ── */}
        {stage === 'script' && hasProfile && (
          <div>
            <SectionHeader
              step={1} total={7}
              title="Paste your raw idea"
              subtitle="A rough transcript, voice note, bullet points — whatever captures the idea."
            />
            <textarea
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-sm leading-relaxed text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-0"
              rows={16}
              placeholder="Dump your raw idea here — a ramble, voice note transcript, bullet points, anything..."
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />
            <button
              onClick={generateClaims}
              disabled={!script.trim()}
              className="mt-4 rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Generate Claims
            </button>
          </div>
        )}

        {/* ── Stage: Loading Claims ── */}
        {stage === 'loading-claims' && (
          retryError ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="rounded-lg border border-red-900 bg-red-950/40 px-6 py-4 text-sm text-red-400 text-center max-w-md">
                {retryError}
              </div>
              {retryCount < 3 ? (
                <button
                  onClick={handleRetry}
                  className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-400"
                >
                  Retry
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-zinc-500">Something isn&apos;t working. Try starting this stage over.</p>
                  <button
                    onClick={handleRetryFallback}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm text-zinc-300 hover:bg-zinc-700"
                  >
                    Go back
                  </button>
                </div>
              )}
            </div>
          ) : (
            <TensionTriangleProgress stage="claim" isComplete={pipelineComplete === 'claim'} />
          )
        )}

        {/* ── Stage: Select Claim ── */}
        {stage === 'select-claim' && (
          <div>
            <SectionHeader
              step={2} total={7}
              title="Select the core claim"
              subtitle="Pick the angle that best captures what this video argues."
            />
            <div className="flex flex-col gap-3">
              {claims.map((c, i) => {
                const editId = `claim-${i}`;
                const isEditing = editingId === editId;
                const isExpanded = expandedBriefId === c.id;
                const displayText = getDisplayText(editId, c.claim);
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl border px-5 py-4 transition-all hover:border-orange-500/60 hover:bg-zinc-800 ${isEditing ? 'border-orange-500/40 bg-zinc-900' : 'border-zinc-800 bg-zinc-900'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {isEditing ? (
                        <textarea
                          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm leading-relaxed text-zinc-200 outline-none focus:border-orange-500/40"
                          rows={3}
                          value={displayText}
                          onChange={(e) => updateEditedText(editId, e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-medium leading-relaxed text-white">
                          {displayText}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PencilButton active={isEditing} onClick={() => toggleEdit(editId, c.claim)} />
                        {c.score != null && (
                          <span className="text-xs text-zinc-400 bg-zinc-800 rounded px-1.5 py-0.5 tabular-nums font-medium">
                            {Number(c.score).toFixed(1)}
                          </span>
                        )}
                        {c.video_format && (
                          <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/20">
                            {c.video_format}
                          </span>
                        )}
                      </div>
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
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setExpandedBriefId(isExpanded ? null : c.id)}
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {isExpanded ? 'Hide brief' : 'Show brief'}
                        </button>
                        <IconButton
                          icon={isInIdeaBank('claim', c.claim) ? 'bookmarkFilled' : 'bookmark'}
                          onClick={() => toggleIdeaBank('claim', c.claim, { angle: c.angle, video_format: c.video_format || '' })}
                          label={isInIdeaBank('claim', c.claim) ? 'Saved' : 'Save'}
                          active={isInIdeaBank('claim', c.claim)}
                        />
                      </div>
                      <button
                        onClick={() => selectClaim(c, editedTexts[editId])}
                        className="rounded-lg bg-orange-500/10 px-4 py-1.5 text-xs font-medium text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stage: Loading Hooks ── */}
        {stage === 'loading-hooks' && (
          retryError ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="rounded-lg border border-red-900 bg-red-950/40 px-6 py-4 text-sm text-red-400 text-center max-w-md">
                {retryError}
              </div>
              {retryCount < 3 ? (
                <button
                  onClick={handleRetry}
                  className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-400"
                >
                  Retry
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-zinc-500">Something isn&apos;t working. Try starting this stage over.</p>
                  <button
                    onClick={handleRetryFallback}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm text-zinc-300 hover:bg-zinc-700"
                  >
                    Go back
                  </button>
                </div>
              )}
            </div>
          ) : (
            <TensionTriangleProgress stage="hook" isComplete={pipelineComplete === 'hook'} />
          )
        )}

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
              step={3} total={7}
              title="Select a hook"
              subtitle="The opening line spoken in the first 10 seconds."
            />
            <div className="flex flex-col gap-3">
              {hooks.map((h, i) => {
                const editId = `hook-${i}`;
                const isEditing = editingId === editId;
                const displayText = getDisplayText(editId, h.text);
                return (
                  <div
                    key={i}
                    className={`rounded-xl border px-5 py-4 transition-all hover:border-orange-500/60 hover:bg-zinc-800 ${isEditing ? 'border-orange-500/40 bg-zinc-900' : 'border-zinc-800 bg-zinc-900'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {isEditing ? (
                        <textarea
                          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm leading-relaxed text-zinc-200 outline-none focus:border-orange-500/40"
                          rows={3}
                          value={displayText}
                          onChange={(e) => updateEditedText(editId, e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm leading-relaxed text-white">{displayText}</p>
                      )}
                      <PencilButton active={isEditing} onClick={() => toggleEdit(editId, h.text)} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-zinc-600">{h.mechanism}</p>
                        {h.score != null && (
                          <span className="text-xs text-zinc-400 bg-zinc-800 rounded px-1.5 py-0.5 tabular-nums font-medium">
                            {Number(h.score).toFixed(1)}
                          </span>
                        )}
                        <IconButton
                          icon={isInIdeaBank('hook', h.text) ? 'bookmarkFilled' : 'bookmark'}
                          onClick={() => toggleIdeaBank('hook', h.text, { mechanism: h.mechanism })}
                          label={isInIdeaBank('hook', h.text) ? 'Saved' : 'Save'}
                          active={isInIdeaBank('hook', h.text)}
                        />
                      </div>
                      <button
                        onClick={() => selectHook(h, editedTexts[editId])}
                        className="rounded-lg bg-orange-500/10 px-4 py-1.5 text-xs font-medium text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stage: Loading Intros ── */}
        {stage === 'loading-intros' && (
          retryError ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="rounded-lg border border-red-900 bg-red-950/40 px-6 py-4 text-sm text-red-400 text-center max-w-md">
                {retryError}
              </div>
              {retryCount < 3 ? (
                <button
                  onClick={handleRetry}
                  className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-400"
                >
                  Retry
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-zinc-500">Something isn&apos;t working. Try starting this stage over.</p>
                  <button
                    onClick={handleRetryFallback}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm text-zinc-300 hover:bg-zinc-700"
                  >
                    Go back
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Spinner label="Generating intro suggestions..." />
          )
        )}

        {/* ── Stage: Select Intro ── */}
        {stage === 'select-intro' && (
          <div>
            <div className="mb-6 space-y-2">
              <SelectionPill label="Claim" value={chosenClaim?.claim ?? ''} />
              <SelectionPill label="Hook" value={chosenHook?.text ?? ''} />
            </div>
            <SectionHeader
              step={4} total={7}
              title="Select an intro"
              subtitle="How you establish credibility for this specific topic. Optional -- skip if none fit."
            />
            {/* ── Credential Input ── */}
            <div className="mt-2 mb-6">
              <button
                onClick={() => setShowCredentialInput(!showCredentialInput)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showCredentialInput ? '- Hide credential input' : '+ Add a credential you\'d like the intro to reference'}
              </button>
              {showCredentialInput && (
                <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
                  <p className="text-xs font-medium text-zinc-400 mb-2">Add a new credential or experience</p>
                  <textarea
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm leading-relaxed text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/40"
                    rows={2}
                    placeholder="e.g. I was pressured to leave the UAE when the war started..."
                    value={newCredential}
                    onChange={(e) => setNewCredential(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-zinc-600">This won't change current options -- it enriches your profile for next time.</p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={saveCredential}
                      disabled={!newCredential.trim() || credentialSaving}
                      className="rounded-lg bg-orange-500/10 px-4 py-1.5 text-xs font-medium text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {credentialSaving ? 'Saving...' : 'Save credential'}
                    </button>
                    {credentialSaved && (
                      <span className="text-xs text-emerald-400">Saved -- will be used in future runs</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {intros.map((intro) => {
                const editId = `intro-${intro.id}`;
                const isEditing = editingId === editId;
                const displayText = getDisplayText(editId, intro.text);
                return (
                  <div
                    key={intro.id}
                    className={`rounded-xl border px-5 py-4 transition-all hover:border-orange-500/60 hover:bg-zinc-800 ${isEditing ? 'border-orange-500/40 bg-zinc-900' : 'border-zinc-800 bg-zinc-900'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {isEditing ? (
                        <textarea
                          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm leading-relaxed text-zinc-200 outline-none focus:border-orange-500/40"
                          rows={4}
                          value={displayText}
                          onChange={(e) => updateEditedText(editId, e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm leading-relaxed text-white">{displayText}</p>
                      )}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PencilButton active={isEditing} onClick={() => toggleEdit(editId, intro.text)} />
                        <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/20">
                          {intro.credibility_angle}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">{intro.why_this_works}</p>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => selectIntro(intro, editedTexts[editId])}
                        className="rounded-lg bg-orange-500/10 px-4 py-1.5 text-xs font-medium text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={skipIntro}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Skip intro
            </button>
          </div>
        )}

        {/* ── Stage: Loading Thumbnails ── */}
        {stage === 'loading-thumbnails' && (
          retryError ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="rounded-lg border border-red-900 bg-red-950/40 px-6 py-4 text-sm text-red-400 text-center max-w-md">
                {retryError}
              </div>
              {retryCount < 3 ? (
                <button
                  onClick={handleRetry}
                  className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-400"
                >
                  Retry
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-zinc-500">Something isn&apos;t working. Try starting this stage over.</p>
                  <button
                    onClick={handleRetryFallback}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm text-zinc-300 hover:bg-zinc-700"
                  >
                    Go back
                  </button>
                </div>
              )}
            </div>
          ) : (
            <TensionTriangleProgress stage="thumbnail" isComplete={pipelineComplete === 'thumbnail'} />
          )
        )}

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
              step={5} total={7}
              title="Select thumbnail text"
              subtitle="2-5 words that appear on the thumbnail image."
            />
            <div className="grid grid-cols-2 gap-3">
              {thumbnailTexts.map((t, i) => {
                const editId = `thumb-${i}`;
                const isEditing = editingId === editId;
                const displayText = getDisplayText(editId, t.text);
                return (
                  <div
                    key={i}
                    className={`rounded-xl border px-5 py-4 transition-all hover:border-orange-500/60 hover:bg-zinc-800 ${isEditing ? 'border-orange-500/40 bg-zinc-900' : 'border-zinc-800 bg-zinc-900'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {isEditing ? (
                        <input
                          type="text"
                          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-base font-semibold uppercase tracking-wide text-zinc-200 outline-none focus:border-orange-500/40"
                          value={displayText}
                          onChange={(e) => updateEditedText(editId, e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <p className="text-base font-semibold uppercase tracking-wide text-white">
                          {displayText}
                        </p>
                      )}
                      <PencilButton active={isEditing} onClick={() => toggleEdit(editId, t.text)} />
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-xs text-zinc-600">{t.visual_concept}</p>
                      {t.score != null && (
                        <span className="text-xs text-zinc-400 bg-zinc-800 rounded px-1.5 py-0.5 tabular-nums font-medium">
                          {Number(t.score).toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <IconButton
                        icon={isInIdeaBank('thumbnailText', t.text) ? 'bookmarkFilled' : 'bookmark'}
                        onClick={() => toggleIdeaBank('thumbnailText', t.text, { visual_concept: t.visual_concept })}
                        label={isInIdeaBank('thumbnailText', t.text) ? 'Saved' : 'Save'}
                        active={isInIdeaBank('thumbnailText', t.text)}
                      />
                      <button
                        onClick={() => selectThumbnail(t, editedTexts[editId])}
                        className="rounded-lg bg-orange-500/10 px-4 py-1.5 text-xs font-medium text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* thumbnail-image stage removed — thumbnail creation is now on the done screen */}

        {/* ── Stage: Loading Titles ── */}
        {stage === 'loading-titles' && (
          retryError ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="rounded-lg border border-red-900 bg-red-950/40 px-6 py-4 text-sm text-red-400 text-center max-w-md">
                {retryError}
              </div>
              {retryCount < 3 ? (
                <button
                  onClick={handleRetry}
                  className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-400"
                >
                  Retry
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-zinc-500">Something isn&apos;t working. Try starting this stage over.</p>
                  <button
                    onClick={handleRetryFallback}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm text-zinc-300 hover:bg-zinc-700"
                  >
                    Go back
                  </button>
                </div>
              )}
            </div>
          ) : (
            <TensionTriangleProgress stage="title" isComplete={pipelineComplete === 'title'} />
          )
        )}

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
              step={7} total={7}
              title="Select a title"
              subtitle="All titles are under 60 characters. Pick the best one."
            />
            <div className="flex flex-col gap-3">
              {titles.map((t, i) => {
                const editId = `title-${i}`;
                const isEditing = editingId === editId;
                const displayText = getDisplayText(editId, t.text);
                const charCount = (editedTexts[editId] ?? t.text).length;
                return (
                  <div
                    key={i}
                    className={`rounded-xl border px-5 py-4 transition-all hover:border-orange-500/60 hover:bg-zinc-800 ${isEditing ? 'border-orange-500/40 bg-zinc-900' : 'border-zinc-800 bg-zinc-900'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {isEditing ? (
                        <input
                          type="text"
                          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 outline-none focus:border-orange-500/40"
                          value={displayText}
                          onChange={(e) => updateEditedText(editId, e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-medium text-white">{displayText}</p>
                      )}
                      <PencilButton active={isEditing} onClick={() => toggleEdit(editId, t.text)} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${charCount > 60 ? 'text-red-400 font-medium' : 'text-zinc-600'}`}>{charCount}/60 chars</span>
                        <span className="text-xs text-zinc-700">·</span>
                        <span className="text-xs text-zinc-600">{t.formula}</span>
                        {t.score != null && (
                          <>
                            <span className="text-xs text-zinc-700">·</span>
                            <span className="text-xs text-zinc-400 bg-zinc-800 rounded px-1.5 py-0.5 tabular-nums font-medium">
                              {Number(t.score).toFixed(1)}
                            </span>
                          </>
                        )}
                        <IconButton
                          icon={isInIdeaBank('title', t.text) ? 'bookmarkFilled' : 'bookmark'}
                          onClick={() => toggleIdeaBank('title', t.text, { formula: t.formula })}
                          label={isInIdeaBank('title', t.text) ? 'Saved' : 'Save'}
                          active={isInIdeaBank('title', t.text)}
                        />
                      </div>
                      <button
                        onClick={() => selectTitle(t, editedTexts[editId])}
                        className="rounded-lg bg-orange-500/10 px-4 py-1.5 text-xs font-medium text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stage: Saving ── */}
        {stage === 'saving' && (
          retryError ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="rounded-lg border border-red-900 bg-red-950/40 px-6 py-4 text-sm text-red-400 text-center max-w-md">
                {retryError}
              </div>
              {retryCount < 3 ? (
                <button
                  onClick={handleRetry}
                  className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-400"
                >
                  Retry
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-zinc-500">Something isn&apos;t working. Try starting this stage over.</p>
                  <button
                    onClick={handleRetryFallback}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm text-zinc-300 hover:bg-zinc-700"
                  >
                    Go back
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Spinner label="Generating your YouTube Brief..." />
          )
        )}

        {/* ── Stage: Done ── */}
        {stage === 'done' && (
          <div>
            <div className="mb-6">
              <p className="mb-1 text-xs font-medium uppercase tracking-widest text-orange-500">Complete</p>
              <h2 className="text-2xl font-semibold text-white">Your YouTube Brief</h2>
            </div>

            {/* Hero: Title + Thumbnail */}
            <div className="rounded-xl border border-orange-500/40 bg-orange-500/5 px-6 py-5 mb-3">
              {/* Thumbnail image (if generated) */}
              {thumbnailImageUrl && (
                <div className="relative mb-4">
                  <img src={thumbnailImageUrl} alt="Generated thumbnail" className="w-full rounded-lg aspect-video object-cover" />
                  <button
                    onClick={() => { setThumbnailImageUrl(null); setThumbnailStudioOpen(true); }}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-zinc-900/85 backdrop-blur border border-zinc-700 text-zinc-400 px-3 py-1.5 rounded-lg text-xs hover:text-zinc-200 transition-colors"
                  >
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                    Regenerate
                  </button>
                </div>
              )}

              {/* Collapsible thumbnail studio (when no image exists) */}
              {!thumbnailImageUrl && (
                <div className="mb-4 rounded-lg border border-zinc-800 overflow-hidden">
                  <button
                    onClick={() => setThumbnailStudioOpen(!thumbnailStudioOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                      <span className="text-sm font-semibold text-zinc-400">Create Thumbnail</span>
                      <span className="text-xs text-zinc-600">Optional</span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-zinc-600 transition-transform ${thumbnailStudioOpen ? 'rotate-180' : ''}`}
                      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {thumbnailStudioOpen && (
                    <div className="px-4 pb-4">
                      <ThumbnailImageStudio
                        creatorName={creatorName}
                        chosenThumbnailText={chosenThumbnail?.text || ''}
                        onComplete={(url) => {
                          setThumbnailImageUrl(url);
                          setThumbnailStudioOpen(false);
                        }}
                        mode="done"
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Title</div>
                  {doneEditing === 'title' ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={doneEditText}
                        onChange={e => setDoneEditText(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button onClick={saveDoneEdit} className="text-xs text-orange-500 hover:text-orange-400">Save</button>
                        <button onClick={cancelDoneEdit} className="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-lg font-semibold text-orange-300 leading-snug">{chosenTitle?.text ?? ''}</p>
                  )}
                </div>
                <div className="flex gap-0.5 pt-4">
                  <CopyButton text={chosenTitle?.text || ''} />
                  <IconButton icon="edit" onClick={() => startDoneEdit('title', chosenTitle?.text || '')} title="Edit" />
                </div>
              </div>
              <div className="mt-2 flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Thumbnail Text</div>
                  {doneEditing === 'thumbnailText' ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={doneEditText}
                        onChange={e => setDoneEditText(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button onClick={saveDoneEdit} className="text-xs text-orange-500 hover:text-orange-400">Save</button>
                        <button onClick={cancelDoneEdit} className="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">{chosenThumbnail?.text ?? ''}</span>
                  )}
                  <p className="text-[11px] text-zinc-600 mt-1">This text appears ON your thumbnail image</p>
                </div>
                <div className="flex gap-0.5 pt-4">
                  <CopyButton text={chosenThumbnail?.text || ''} />
                  <IconButton icon="edit" onClick={() => startDoneEdit('thumbnailText', chosenThumbnail?.text || '')} title="Edit" />
                </div>
                {chosenClaim?.video_format && (
                  <span className="text-xs text-zinc-500 pt-5">{chosenClaim.video_format}</span>
                )}
              </div>
            </div>

            {/* Spoken: Hook + Intro */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 mb-3 space-y-3">
              <div>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Hook</div>
                    {doneEditing === 'hook' ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={doneEditText}
                          onChange={e => setDoneEditText(e.target.value)}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button onClick={saveDoneEdit} className="text-xs text-orange-500 hover:text-orange-400">Save</button>
                          <button onClick={cancelDoneEdit} className="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed text-zinc-200">{chosenHook?.text ?? ''}</p>
                    )}
                  </div>
                  <div className="flex gap-0.5 pt-4">
                    <CopyButton text={chosenHook?.text || ''} />
                    <IconButton icon="edit" onClick={() => startDoneEdit('hook', chosenHook?.text || '')} title="Edit" />
                  </div>
                </div>
              </div>
              {chosenIntro && (
                <div className="pt-3 border-t border-zinc-800">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Intro</div>
                        <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/20">
                          {chosenIntro.credibility_angle}
                        </span>
                      </div>
                      {doneEditing === 'intro' ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={doneEditText}
                            onChange={e => setDoneEditText(e.target.value)}
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button onClick={saveDoneEdit} className="text-xs text-orange-500 hover:text-orange-400">Save</button>
                            <button onClick={cancelDoneEdit} className="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed text-zinc-200">{chosenIntro.text}</p>
                      )}
                    </div>
                    <div className="flex gap-0.5 pt-4">
                      <CopyButton text={chosenIntro?.text || ''} />
                      <IconButton icon="edit" onClick={() => startDoneEdit('intro', chosenIntro?.text || '')} title="Edit" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Brief: Claim + metadata */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 mb-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Claim</div>
                  {doneEditing === 'claim' ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={doneEditText}
                        onChange={e => setDoneEditText(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button onClick={saveDoneEdit} className="text-xs text-orange-500 hover:text-orange-400">Save</button>
                        <button onClick={cancelDoneEdit} className="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-200 mb-3">{chosenClaim?.claim ?? ''}</p>
                  )}
                </div>
                <div className="flex gap-0.5 pt-4">
                  <CopyButton text={chosenClaim?.claim || ''} />
                  <IconButton icon="edit" onClick={() => startDoneEdit('claim', chosenClaim?.claim || '')} title="Edit" />
                </div>
              </div>
              {chosenClaim && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-3 border-t border-zinc-800">
                  {chosenClaim.target_audience && (
                    <div className="text-xs"><span className="text-zinc-600 font-medium">Audience</span><p className="text-zinc-400 mt-0.5">{chosenClaim.target_audience}</p></div>
                  )}
                  {chosenClaim.pain_point && (
                    <div className="text-xs"><span className="text-zinc-600 font-medium">Pain point</span><p className="text-zinc-400 mt-0.5">{chosenClaim.pain_point}</p></div>
                  )}
                  {chosenClaim.promise_structure && (
                    <div className="text-xs col-span-2"><span className="text-zinc-600 font-medium">Promise</span><p className="text-zinc-400 mt-0.5">{chosenClaim.promise_structure}</p></div>
                  )}
                  {chosenClaim.viewer_transformation && (
                    <div className="text-xs col-span-2"><span className="text-zinc-600 font-medium">Transformation</span><p className="text-zinc-400 mt-0.5">{chosenClaim.viewer_transformation}</p></div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center gap-3">
              {thumbnailImageUrl && (
                <a
                  href={thumbnailImageUrl}
                  download="thumbnail.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-400"
                >
                  Download thumbnail
                </a>
              )}
              <button
                onClick={() => {
                  copyToClipboard(formatBriefForCopy({
                    title: chosenTitle?.text,
                    thumbnailText: chosenThumbnail?.text,
                    hook: chosenHook?.text,
                    intro: chosenIntro?.text,
                    claim: chosenClaim?.claim,
                  }));
                }}
                className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy All
              </button>
              <button
                onClick={reset}
                className="rounded-lg border border-zinc-800 px-6 py-3 text-sm text-zinc-400 transition-all hover:border-zinc-600 hover:text-white"
              >
                Start new video
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
