'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;

interface FormData {
  creatorName: string;
  oneLiner: string;
  targetAudience: string;
  brandTone: string;
  speakingModes: string;
  coreBeliefs: string;
  signatureMoves: string;
  hardNos: string;
  voiceCalibration: string;
  contentPillars: string;
  proprietaryTerms: string;
  wordsToAvoid: string;
  credentialsBio: string;
}

const INITIAL_FORM: FormData = {
  creatorName: '',
  oneLiner: '',
  targetAudience: '',
  brandTone: '',
  speakingModes: '',
  coreBeliefs: '',
  signatureMoves: '',
  hardNos: '',
  voiceCalibration: '',
  contentPillars: '',
  proprietaryTerms: '',
  wordsToAvoid: '',
  credentialsBio: '',
};

const STEP_FIELDS: (keyof FormData)[][] = [
  ['creatorName', 'oneLiner', 'targetAudience'],
  ['brandTone', 'speakingModes', 'coreBeliefs', 'signatureMoves'],
  ['hardNos', 'voiceCalibration', 'contentPillars', 'proprietaryTerms', 'wordsToAvoid'],
  ['credentialsBio'],
];

const REQUIRED_FIELDS: (keyof FormData)[] = [
  'creatorName', 'oneLiner', 'targetAudience',
  'brandTone', 'coreBeliefs',
  'hardNos',
  'credentialsBio',
];

function isStepValid(step: number, form: FormData): boolean {
  return STEP_FIELDS[step]
    .filter((f) => REQUIRED_FIELDS.includes(f))
    .every((f) => form[f].trim().length > 0);
}

// ─── Field Config ───────────────────────────────────────────────────────────

interface FieldConfig {
  key: keyof FormData;
  label: string;
  placeholder: string;
  type: 'input' | 'textarea';
  required: boolean;
}

const FIELDS: Record<number, FieldConfig[]> = {
  0: [
    { key: 'creatorName', label: 'Your name or channel name', placeholder: 'e.g. Josh Tanner', type: 'input', required: true },
    { key: 'oneLiner', label: 'Describe your channel in one sentence', placeholder: 'e.g. A doctor who reverse-engineers elite mental performance', type: 'input', required: true },
    { key: 'targetAudience', label: 'Who do you make videos for?', placeholder: 'Describe their situation, not demographics \u2014 what are they stuck on, what have they tried?', type: 'textarea', required: true },
  ],
  1: [
    { key: 'brandTone', label: 'How do you actually talk? Quote yourself or compare to someone.', placeholder: 'e.g. Like a sharp friend over drinks \u2014 slightly provocative, never preachy, concrete analogies over abstraction', type: 'textarea', required: true },
    { key: 'speakingModes', label: 'Do you have different gears? Intense vs. quiet? Fired up vs. precise?', placeholder: 'e.g. Sometimes ranting with energy, other times going still to find the right word. Or: pretty consistent \u2014 always calm.', type: 'textarea', required: false },
    { key: 'coreBeliefs', label: 'Beliefs you\u2019d argue for in any room (and any you hold loosely)', placeholder: 'Strong: "Your mind is programmable \u2014 most people are running someone else\u2019s code." Loose: "Ancient texts might contain clues we haven\u2019t grasped."', type: 'textarea', required: true },
    { key: 'signatureMoves', label: 'When you disagree with a popular idea, how do you handle it?', placeholder: 'e.g. I never tear down \u2014 I build a better framework and let people compare. I correct by creation, not destruction.', type: 'textarea', required: false },
  ],
  2: [
    { key: 'hardNos', label: 'Things your content should NEVER do or say', placeholder: 'e.g. No guru positioning, no fear-based warnings, no sappy platitudes, no framework showcases that assume insider knowledge', type: 'textarea', required: true },
    { key: 'voiceCalibration', label: 'A sentence that sounds like YOU, and one that makes you cringe', placeholder: 'Like me: "We spend billions building AI that mimics behavior but barely understand behavior itself." Cringe: "In today\u2019s evolving landscape, we need to lean into a nuanced understanding..."', type: 'textarea', required: false },
    { key: 'contentPillars', label: 'Your 2\u20134 recurring topics with your specific angle', placeholder: 'e.g. Mind mechanics \u2014 how your mind works as a system, not how self-help says it should', type: 'textarea', required: false },
    { key: 'proprietaryTerms', label: 'Any signature phrases or coined terms?', placeholder: 'e.g. MindWare, Psychosecurity, Belief Architecture', type: 'input', required: false },
    { key: 'wordsToAvoid', label: 'Words that don\u2019t sound like you', placeholder: 'e.g. quietly, lean into, unpack, game-changer, unlock your potential', type: 'input', required: false },
  ],
  3: [
    { key: 'credentialsBio', label: 'Your relevant background (2\u20133 sentences)', placeholder: 'What makes you credible on the topics you cover? Focus on experience, not titles.', type: 'textarea', required: true },
  ],
};

const STEP_TITLES = ['Who are you?', 'How do you sound?', 'Your boundaries & style', 'Why should they listen?'];
const STEP_SUBTITLES = [
  'Your identity, audience, and what your channel is about.',
  'The voice, beliefs, and patterns that make your content unmistakably yours.',
  'What you refuse to do, and examples that calibrate your voice.',
  'The credentials that earn attention.',
];

// ─── Component ───────────────────────────────────────────────────────────────

function SetupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingProfiles, setExistingProfiles] = useState<string[]>([]);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    const profiles = JSON.parse(localStorage.getItem('ytPipelineProfiles') || '[]') as string[];
    setExistingProfiles(profiles);
    const currentCreator = localStorage.getItem('ytPipelineCreator');
    if (currentCreator) {
      const savedProfile = localStorage.getItem('ytPipelineProfile:' + currentCreator);
      if (savedProfile) {
        try { setForm(JSON.parse(savedProfile)); } catch {}
      }
    }
    if (profiles.length === 0 || searchParams.get('mode') === 'form') {
      setShowWizard(true);
    }
  }, []);

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectExistingProfile = (name: string) => {
    localStorage.setItem('ytPipelineCreator', name);
    router.push('/pipeline');
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${N8N_BASE}/yt-save-voice-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      // Save to localStorage
      const profiles = JSON.parse(localStorage.getItem('ytPipelineProfiles') || '[]') as string[];
      if (!profiles.includes(form.creatorName)) {
        profiles.push(form.creatorName);
        localStorage.setItem('ytPipelineProfiles', JSON.stringify(profiles));
      }
      localStorage.setItem('ytPipelineCreator', form.creatorName);
      localStorage.setItem('ytPipelineProfile:' + form.creatorName, JSON.stringify(form));
      router.push('/pipeline');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
      setSaving(false);
    }
  };

  // ── Profile Selector ────────────────────────────────────────────────────

  if (!showWizard && existingProfiles.length > 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="mb-12">
            <h1 className="text-lg font-semibold tracking-tight text-white">YouTube AI Team</h1>
            <p className="text-sm text-zinc-600">Select a creator profile</p>
          </div>

          <div className="flex flex-col gap-3">
            {existingProfiles.map((name) => (
              <button
                key={name}
                onClick={() => selectExistingProfile(name)}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-left transition-all hover:border-orange-500/60 hover:bg-zinc-800"
              >
                <span className="text-sm font-medium text-white">{name}</span>
                <span className="text-xs text-zinc-600">Use this profile &rarr;</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowWizard(true)}
            className="mt-6 text-sm text-zinc-500 underline hover:text-zinc-300 transition-colors"
          >
            + Create new profile
          </button>
        </div>
      </div>
    );
  }

  // ── Wizard ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-lg font-semibold tracking-tight text-white">YouTube AI Team</h1>
          <p className="text-sm text-zinc-600">Voice Profile Setup</p>
        </div>

        {/* Progress bar */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-orange-500' : 'bg-zinc-800'
                }`}
              />
            ))}
          </div>
          <p className="text-xs font-medium uppercase tracking-widest text-orange-500">
            Step {step + 1} of 4
          </p>
        </div>

        {/* Step header */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-white">{STEP_TITLES[step]}</h2>
          <p className="mt-1 text-sm text-zinc-500">{STEP_SUBTITLES[step]}</p>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-5">
          {FIELDS[step].map((field) => (
            <div key={field.key}>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                {field.label}
                {!field.required && <span className="ml-1 text-zinc-700">(optional)</span>}
              </label>
              {field.type === 'input' ? (
                <input
                  type="text"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-0"
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={(e) => updateField(field.key, e.target.value)}
                />
              ) : (
                <textarea
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm leading-relaxed text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-0"
                  rows={4}
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={(e) => updateField(field.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => {
              if (step === 0 && existingProfiles.length > 0) {
                setShowWizard(false);
              } else {
                setStep((s) => s - 1);
              }
            }}
            className={`text-sm text-zinc-500 hover:text-zinc-300 transition-colors ${step === 0 && existingProfiles.length === 0 ? 'invisible' : ''}`}
          >
            &larr; Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!isStepValid(step, form)}
              className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Continue &rarr;
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!isStepValid(step, form) || saving}
              className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating Profile...
                </span>
              ) : (
                'Create Profile \u2192'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense>
      <SetupPageInner />
    </Suspense>
  );
}
