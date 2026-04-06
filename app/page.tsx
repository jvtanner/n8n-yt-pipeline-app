'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PipelineHistory from '@/components/PipelineHistory';
import YouTubeChannelInput from '@/components/YouTubeChannelInput';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import IdeaBankSection from '@/components/IdeaBankSection';

interface ProfileData {
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

function ProfileField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm text-zinc-300 leading-relaxed line-clamp-2">{value}</p>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profiles, setProfiles] = useState<string[]>([]);

  useEffect(() => {
    const name = localStorage.getItem('ytPipelineCreator');
    const allProfiles = JSON.parse(localStorage.getItem('ytPipelineProfiles') || '[]') as string[];
    setProfiles(allProfiles);

    if (name) {
      setCreatorName(name);
      const saved = localStorage.getItem('ytPipelineProfile:' + name);
      if (saved) {
        try { setProfile(JSON.parse(saved)); } catch {}
      }
    }
    setLoading(false);
  }, []);

  const handleGetStarted = () => {
    if (!nameInput.trim()) return;
    const name = nameInput.trim();
    localStorage.setItem('ytPipelineCreator', name);
    const allProfiles = JSON.parse(localStorage.getItem('ytPipelineProfiles') || '[]') as string[];
    if (!allProfiles.includes(name)) {
      allProfiles.push(name);
      localStorage.setItem('ytPipelineProfiles', JSON.stringify(allProfiles));
    }
    router.push('/pipeline');
  };

  const switchProfile = (name: string) => {
    localStorage.setItem('ytPipelineCreator', name);
    setCreatorName(name);
    const saved = localStorage.getItem('ytPipelineProfile:' + name);
    if (saved) {
      try { setProfile(JSON.parse(saved)); } catch { setProfile(null); }
    } else {
      setProfile(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
      </div>
    );
  }

  // New user — name entry
  if (!creatorName) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="max-w-md w-full px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-white">YouTube AI Team</h1>
          <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
            Your AI specialists for claims, hooks, intros, thumbnails, and titles.
          </p>

          <div className="mt-10">
            <label className="block text-xs font-medium text-zinc-400 mb-2">What should we call you?</label>
            <input
              type="text"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-0"
              placeholder="Your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGetStarted()}
              autoFocus
            />
            <button
              onClick={handleGetStarted}
              disabled={!nameInput.trim()}
              className="mt-4 w-full rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Get started
            </button>
          </div>

          {profiles.length > 0 && (
            <div className="mt-8 pt-6 border-t border-zinc-800">
              <p className="text-xs text-zinc-600 mb-2">Or continue as:</p>
              <div className="flex flex-wrap gap-2">
                {profiles.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      localStorage.setItem('ytPipelineCreator', p);
                      router.push('/pipeline');
                    }}
                    className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:border-zinc-600 hover:text-white transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Returning user — dashboard
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-2xl px-6 py-16">

        <h1 className="text-2xl font-semibold tracking-tight text-white">YouTube AI Team</h1>
        <p className="mt-1 text-sm text-zinc-500">Your AI specialists for claims, hooks, intros, thumbnails, and titles</p>

        {/* Profile Card */}
        <div className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-orange-500">Active Profile</p>
              <p className="mt-1 text-lg font-semibold text-white">{creatorName}</p>
            </div>
            <button
              onClick={() => router.push('/setup')}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-white transition-all"
            >
              Edit profile
            </button>
          </div>

          {profile ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-4 border-t border-zinc-800">
              <ProfileField label="One-liner" value={profile.oneLiner} />
              <ProfileField label="Brand tone" value={profile.brandTone} />
              <ProfileField label="Target audience" value={profile.targetAudience} />
              <ProfileField label="Content pillars" value={profile.contentPillars} />
              <div className="col-span-2">
                <ProfileField label="Credentials" value={profile.credentialsBio} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-600 pt-4 border-t border-zinc-800">
              No voice profile yet. You can create one from the pipeline page to personalize results.
            </p>
          )}
        </div>

        {/* YouTube Channel */}
        <div className="mt-4">
          <YouTubeChannelInput creatorName={creatorName} />
        </div>

        {/* Profile Switcher */}
        {profiles.length > 1 && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-zinc-600">Switch:</span>
            {profiles.filter(p => p !== creatorName).map((p) => (
              <button
                key={p}
                onClick={() => switchProfile(p)}
                className="text-xs text-zinc-500 hover:text-orange-400 underline transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={() => router.push('/pipeline')}
            className="rounded-lg bg-orange-500 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-400"
          >
            Start pipeline
          </button>
          <button
            onClick={() => {
              setCreatorName(null);
              setNameInput('');
            }}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            New profile
          </button>
        </div>

        {/* Video Performance */}
        <AnalyticsDashboard creatorName={creatorName} />

        {/* History */}
        <PipelineHistory />

        {/* Idea Bank */}
        <IdeaBankSection />

      </div>
    </div>
  );
}
