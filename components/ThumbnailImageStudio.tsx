'use client';

import { useState, useCallback, useEffect } from 'react';
import ImageDropZone from './ImageDropZone';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubState = 'template' | 'upload' | 'generating' | 'review';

interface Template {
  id: string;
  name: string;
  description: string;
  textPosition: string;
}

interface ThumbnailImageStudioProps {
  creatorName: string;
  chosenThumbnailText: string;
  onComplete: (imageUrl: string) => void;
  onSkip: () => void;
}

// ─── Template Definitions ─────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  {
    id: 'object-left',
    name: 'Object Left',
    description: 'Subject on the left, text space on the right',
    textPosition: 'right',
  },
  {
    id: 'object-center',
    name: 'Object Center',
    description: 'Subject centered, text space above',
    textPosition: 'top',
  },
  {
    id: 'object-right',
    name: 'Object Right',
    description: 'Subject on the right, text space on the left',
    textPosition: 'left',
  },
];

// ─── Layout Preview SVGs ──────────────────────────────────────────────────────

function LayoutPreview({ textPosition }: { textPosition: string }) {
  return (
    <svg viewBox="0 0 160 90" className="w-full rounded-lg" fill="none">
      <rect width="160" height="90" rx="4" fill="#18181b" />
      {textPosition === 'right' && (
        <>
          <rect x="8" y="10" width="60" height="70" rx="4" fill="#3f3f46" />
          <rect x="80" y="30" width="64" height="6" rx="2" fill="#52525b" opacity="0.5" />
          <rect x="80" y="42" width="48" height="6" rx="2" fill="#52525b" opacity="0.3" />
        </>
      )}
      {textPosition === 'top' && (
        <>
          <rect x="40" y="30" width="80" height="52" rx="4" fill="#3f3f46" />
          <rect x="30" y="10" width="100" height="6" rx="2" fill="#52525b" opacity="0.5" />
        </>
      )}
      {textPosition === 'left' && (
        <>
          <rect x="92" y="10" width="60" height="70" rx="4" fill="#3f3f46" />
          <rect x="8" y="30" width="64" height="6" rx="2" fill="#52525b" opacity="0.5" />
          <rect x="8" y="42" width="48" height="6" rx="2" fill="#52525b" opacity="0.3" />
        </>
      )}
    </svg>
  );
}

// ─── Webhook + Polling (matches app pattern) ──────────────────────────────────

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;
const WORKFLOW_ID = process.env.NEXT_PUBLIC_WF_THUMBNAIL_IMAGE_GEN || 'nTA0DgdesN7hsoUy';

async function pollForResult(startedAfter: string, timeoutMs = 600000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  await new Promise(r => setTimeout(r, 10000));

  while (Date.now() < deadline) {
    const res = await fetch(`/api/poll?workflowId=${WORKFLOW_ID}&startedAfter=${encodeURIComponent(startedAfter)}`);
    if (!res.ok) throw new Error('Poll request failed');
    const result = await res.json();
    if (result.status === 'complete') return result.data;
    if (result.status === 'error') throw new Error(result.message || 'Generation failed');
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Thumbnail generation timed out');
}

async function generateThumbnailImage(
  templateId: string,
  imageUrls: string[],
  resolution: string,
  creatorName: string,
): Promise<{ imageUrl: string }> {
  const startedAfter = new Date().toISOString();

  // Fire the webhook to trigger the workflow, but don't wait for the response.
  // Cloudflare 524s and CORS errors make direct responses unreliable for
  // long-running tasks. We rely entirely on polling the execution result.
  fetch(`${N8N_BASE}/yt-thumbnail-image-gen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, imageUrls, resolution, creatorName }),
  }).catch(() => {});

  const data = await pollForResult(startedAfter);
  return { imageUrl: (data.imageUrl as string) || '' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ThumbnailImageStudio({
  creatorName,
  chosenThumbnailText,
  onComplete,
  onSkip,
}: ThumbnailImageStudioProps) {
  const [subState, setSubState] = useState<SubState>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [resolution, setResolution] = useState<'1K' | '4K'>('1K');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Elapsed timer during generation
  useEffect(() => {
    if (subState !== 'generating') return;
    setElapsed(0);
    const interval = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [subState]);

  const selectTemplate = useCallback((t: Template) => {
    setSelectedTemplate(t);
    setImageUrl(null);
    setSubState('upload');
  }, []);

  const startGeneration = useCallback(async () => {
    if (!selectedTemplate || !imageUrl) return;
    setError(null);
    setSubState('generating');
    try {
      const result = await generateThumbnailImage(
        selectedTemplate.id,
        [imageUrl],
        resolution,
        creatorName,
      );
      if (!result.imageUrl) throw new Error('No image URL returned');
      setGeneratedImage(result.imageUrl);
      setSubState('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
      setSubState('upload');
    }
  }, [selectedTemplate, imageUrl, resolution, creatorName]);

  return (
    <div>
      {/* Context pills */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-600 font-medium">Thumbnail text:</span>
          <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/20">
            {chosenThumbnailText}
          </span>
        </div>
      </div>

      {/* Section header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">Step 6 / 7</span>
        </div>
        <h2 className="text-lg font-semibold text-white">
          {subState === 'template' && 'Choose a layout template'}
          {subState === 'upload' && 'Add your image'}
          {subState === 'generating' && 'Generating thumbnail...'}
          {subState === 'review' && 'Your generated thumbnail'}
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          {subState === 'template' && 'Pick where you want the subject and text to go.'}
          {subState === 'upload' && 'Drop in a photo or paste a URL from Pinterest, Google, etc.'}
          {subState === 'generating' && 'Your thumbnail is generating. This can take several minutes.'}
          {subState === 'review' && 'Review the result. Use it, regenerate, or try a different template.'}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-950/50 border border-red-900/50 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-600 hover:text-red-400">&times;</button>
        </div>
      )}

      {/* ── Template Selection ── */}
      {subState === 'template' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-all hover:border-orange-500/60 hover:bg-zinc-800"
              >
                <LayoutPreview textPosition={t.textPosition} />
                <p className="mt-3 text-sm font-semibold text-white">{t.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{t.description}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={onSkip}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Skip image generation
            </button>
          </div>
        </div>
      )}

      {/* ── Image Upload ── */}
      {subState === 'upload' && selectedTemplate && (
        <div className="space-y-4">
          {/* Selected template badge */}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 border border-zinc-700">
              {selectedTemplate.name}
            </span>
            <button
              onClick={() => { setSubState('template'); setImageUrl(null); }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Change
            </button>
          </div>

          <ImageDropZone onUploaded={setImageUrl} />

          {/* Resolution toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Resolution:</span>
            <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
              <button
                onClick={() => setResolution('1K')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  resolution === '1K' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                1K (fast)
              </button>
              <button
                onClick={() => setResolution('4K')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  resolution === '4K' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                4K (sharper)
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={onSkip}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Skip image generation
            </button>
            <button
              onClick={startGeneration}
              disabled={!imageUrl}
              className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-30 transition-all"
            >
              Generate Thumbnail
            </button>
          </div>
        </div>
      )}

      {/* ── Generating ── */}
      {subState === 'generating' && (
        <div className="space-y-4">
          <div className="relative rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden aspect-video flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-orange-500/5 animate-pulse" />
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
              <p className="text-sm text-zinc-500">{elapsed}s elapsed</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Review ── */}
      {subState === 'review' && generatedImage && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <img
              src={generatedImage}
              alt="Generated thumbnail"
              className="w-full aspect-video object-cover"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setGeneratedImage(null); setSubState('upload'); }}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={() => { setGeneratedImage(null); setImageUrl(null); setSubState('template'); }}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Try different template
              </button>
            </div>
            <button
              onClick={() => onComplete(generatedImage)}
              className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 transition-all"
            >
              Use this thumbnail
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
