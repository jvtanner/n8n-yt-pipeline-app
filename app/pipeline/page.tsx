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
    if (res.ok) return res.json();
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
  const [creatorName, setCreatorName] = useState('');
  const [stage, setStage] = useState<Stage>('script');
  const [script, setScript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [retryPayload, setRetryPayload] = useState<{ fn: string; args: unknown[] } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    const name = localStorage.getItem('ytPipelineCreator');
    if (!name) { router.replace('/'); return; }
    setCreatorName(name);
    setHasProfile(!!localStorage.getItem('ytPipelineProfile:' + name));
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
  }, [router]);

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

  // ── Credential input state ───────────────────────────────────────────────
  const [newCredential, setNewCredential] = useState('');
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [credentialSaved, setCredentialSaved] = useState(false);
  const [showCredentialInput, setShowCredentialInput] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [sideQuestDismissed, setSideQuestDismissed] = useState(false);

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

  const selectThumbnail = useCallback((thumb: ThumbnailText, overrideText?: string) => {
    const thumbText = overrideText ?? thumb.text;
    setChosenThumbnail({ ...thumb, text: thumbText });
    setError(null);
    setEditingId(null);
    setStage('thumbnail-image');
  }, []);

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

  const completeThumbnailImage = useCallback((imageUrl: string) => {
    setThumbnailImageUrl(imageUrl);
    loadTitles(chosenThumbnail?.text ?? '');
  }, [chosenThumbnail, loadTitles]);

  const skipThumbnailImage = useCallback(() => {
    setThumbnailImageUrl(null);
    loadTitles(chosenThumbnail?.text ?? '');
  }, [chosenThumbnail, loadTitles]);

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
  }, []);

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
      'loading-thumbnail-image': 'select-thumbnail',
      'loading-titles': 'select-thumbnail',
      'saving': 'select-title',
    };
    setStage((fallbackMap[stage] || 'script') as Stage);
  }, [stage]);

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

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-lg font-semibold tracking-tight text-white">YouTube AI Team</h1>
          <p className="text-sm text-zinc-600">Your AI specialists for claims, hooks, intros, thumbnails, and titles</p>
          {creatorName && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-zinc-600">Profile:</span>
              <span className="text-xs text-orange-400 font-medium">{creatorName}</span>
              <button onClick={() => router.push('/')} className="text-xs text-zinc-600 hover:text-zinc-400 underline">Switch</button>
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
                      <button
                        onClick={() => setExpandedBriefId(isExpanded ? null : c.id)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {isExpanded ? 'Hide brief' : 'Show brief'}
                      </button>
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
                      <p className="text-xs text-zinc-600">{h.mechanism}</p>
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

            {/* ── Credential Input ── */}
            <div className="mt-6 mb-4">
              <button
                onClick={() => setShowCredentialInput(!showCredentialInput)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showCredentialInput ? '- Hide credential input' : '+ Add a credential for future runs'}
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
                    <p className="mt-1 text-xs text-zinc-600">{t.visual_concept}</p>
                    <div className="mt-2 flex justify-end">
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

        {/* ── Stage: Thumbnail Image ── */}
        {stage === 'thumbnail-image' && (
          <ThumbnailImageStudio
            creatorName={creatorName}
            chosenThumbnailText={chosenThumbnail?.text ?? ''}
            onComplete={completeThumbnailImage}
            onSkip={skipThumbnailImage}
          />
        )}

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
              {thumbnailImageUrl && (
                <div className="mb-4">
                  <img src={thumbnailImageUrl} alt="Generated thumbnail" className="w-full rounded-lg aspect-video object-cover" />
                </div>
              )}
              <div className="flex items-start gap-2">
                <p className="text-lg font-semibold text-orange-300 leading-snug">{chosenTitle?.text ?? ''}</p>
                <CopyButton text={chosenTitle?.text || ''} />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">{chosenThumbnail?.text ?? ''}</span>
                <CopyButton text={chosenThumbnail?.text || ''} />
                {chosenClaim?.video_format && (
                  <span className="text-xs text-zinc-500">{chosenClaim.video_format}</span>
                )}
              </div>
            </div>

            {/* Spoken: Hook + Intro */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 mb-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-zinc-500">Hook</p>
                  <CopyButton text={chosenHook?.text || ''} />
                </div>
                <p className="text-sm leading-relaxed text-zinc-200">{chosenHook?.text ?? ''}</p>
              </div>
              {chosenIntro && (
                <div className="pt-3 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-zinc-500">Intro</p>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/20">
                        {chosenIntro.credibility_angle}
                      </span>
                      <CopyButton text={chosenIntro?.text || ''} />
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-200">{chosenIntro.text}</p>
                </div>
              )}
            </div>

            {/* Brief: Claim + metadata */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-500">Claim</p>
                <CopyButton text={chosenClaim?.claim || ''} />
              </div>
              <p className="text-sm text-zinc-200 mb-3">{chosenClaim?.claim ?? ''}</p>
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
