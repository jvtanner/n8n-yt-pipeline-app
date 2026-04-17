'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PipelineHistory from '@/components/PipelineHistory';
import YouTubeChannelInput from '@/components/YouTubeChannelInput';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import IdeaBankSection from '@/components/IdeaBankSection';
import { useUser, type VoiceProfile } from '@/lib/useUser';
import { clearSession } from '@/lib/session';

function ProfileField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm text-zinc-300 leading-relaxed line-clamp-2">{value}</p>
    </div>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  expired: 'That login link has expired. Enter your email to get a new one.',
  used: 'That login link has already been used. Enter your email to get a new one.',
  invalid: 'That login link is invalid. Enter your email to try again.',
  server: 'Something went wrong. Please try again.',
};

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, isGuest, logout, updateProfile } = useUser();

  const [emailInput, setEmailInput] = useState('');
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'not_found'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);

  // Server-side history and bookmarks for authenticated users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [serverRuns, setServerRuns] = useState<any[] | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [serverBookmarks, setServerBookmarks] = useState<any[] | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);

  useEffect(() => {
    if (!user || isGuest) return;

    setRunsLoading(true);
    fetch('/api/user/runs')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.runs) setServerRuns(data.runs); })
      .catch(() => {})
      .finally(() => setRunsLoading(false));

    setBookmarksLoading(true);
    fetch('/api/user/bookmarks')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.bookmarks) setServerBookmarks(data.bookmarks); })
      .catch(() => {})
      .finally(() => setBookmarksLoading(false));
  }, [user, isGuest]);

  const errorParam = searchParams.get('error');
  const errorMessage = errorParam ? ERROR_MESSAGES[errorParam] || ERROR_MESSAGES.server : null;

  // localStorage migration on first authenticated login
  useEffect(() => {
    if (!user || localStorage.getItem('ytPipelineMigrated') === 'v2') return;

    const migrate = async () => {
      const updates: Record<string, unknown> = {};

      // Migrate voice profile
      const oldName = localStorage.getItem('ytPipelineCreator');
      if (oldName) {
        const savedProfile = localStorage.getItem('ytPipelineProfile:' + oldName);
        if (savedProfile && !user.voiceProfile) {
          try { updates.voiceProfile = JSON.parse(savedProfile); } catch {}
        }
        if (!user.creatorName) {
          updates.creatorName = oldName;
        }
      }

      // Migrate YouTube channel
      const channelId = localStorage.getItem('ytChannelId');
      const channelUrl = localStorage.getItem('ytChannelUrl');
      if (channelId && !user.youtubeChannelId) updates.youtubeChannelId = channelId;
      if (channelUrl && !user.youtubeChannelUrl) updates.youtubeChannelUrl = channelUrl;

      if (Object.keys(updates).length > 0) {
        try {
          await updateProfile(updates as Partial<import('@/lib/useUser').UserProfile>);
          localStorage.setItem('ytPipelineMigrated', 'v2');
        } catch {
          // Don't set flag — retry on next login
          return;
        }
      } else {
        localStorage.setItem('ytPipelineMigrated', 'v2');
      }
    };

    migrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, updateProfile]);

  const handleSendLink = async () => {
    if (!emailInput.trim()) return;
    setSendStatus('sending');
    setSendError(null);

    try {
      const res = await fetch('/api/auth/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim().toLowerCase() }),
      });
      const data = await res.json();

      if (data.status === 'sent') {
        setSendStatus('sent');
      } else {
        setSendStatus('not_found');
      }
    } catch {
      setSendError('Something went wrong. Please try again.');
      setSendStatus('idle');
    }
  };

  const handleFreeRun = () => {
    clearSession();
    router.push('/pipeline');
  };

  const handleLogout = async () => {
    await logout();
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
      </div>
    );
  }

  // ── Mode 2: Authenticated dashboard ─────────────────────────────────────
  if (user && !isGuest) {
    const profile = user.voiceProfile;
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-2xl px-6 py-16">

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">YouTube AI Team</h1>
              <p className="mt-1 text-sm text-zinc-500">Your AI specialists for claims, hooks, intros, thumbnails, and titles</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Log out
            </button>
          </div>

          {/* Profile Card */}
          <div className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-orange-500">Active Profile</p>
                <p className="mt-1 text-lg font-semibold text-white">{user.creatorName || user.email}</p>
                {user.creatorName && (
                  <p className="text-xs text-zinc-500">{user.email}</p>
                )}
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
            <YouTubeChannelInput creatorName={user.creatorName || user.email} />
          </div>

          {/* Actions */}
          <div className="mt-8">
            <button
              onClick={() => { clearSession(); router.push('/pipeline'); }}
              className="rounded-lg bg-orange-500 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-400"
            >
              Create Brief
            </button>
          </div>

          {/* Video Performance */}
          <AnalyticsDashboard creatorName={user.creatorName || user.email} />

          {/* History */}
          <PipelineHistory serverRuns={serverRuns} loading={runsLoading} />

          {/* Idea Bank */}
          <IdeaBankSection
            serverBookmarks={serverBookmarks}
            loading={bookmarksLoading}
            onDelete={async (bookmark) => {
              try {
                await fetch(`/api/user/runs/${bookmark.runPageId}/star`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'remove', item: { type: bookmark.type, text: bookmark.text } }),
                });
                setServerBookmarks((prev) => prev?.filter((b) => b.id !== bookmark.id) ?? null);
              } catch {}
            }}
          />

        </div>
      </div>
    );
  }

  // ── Mode 1 / Mode 3: Unauthenticated (with optional error) ─────────────
  const stripeLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <div className="max-w-md w-full px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white">YouTube AI Team</h1>
        <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
          Your AI specialists for claims, hooks, intros, thumbnails, and titles.
        </p>

        {/* Error from magic link failure */}
        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3">
            <p className="text-sm text-red-400">{errorMessage}</p>
          </div>
        )}

        {/* "Check your inbox" confirmation */}
        {sendStatus === 'sent' && (
          <div className="mt-10">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-8 text-center">
              <div className="text-3xl mb-3">&#9993;</div>
              <p className="text-sm font-medium text-white">Check your inbox</p>
              <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                We sent a login link to <span className="text-zinc-300">{emailInput}</span>.
                <br />It expires in 15 minutes.
              </p>
              <button
                onClick={() => { setSendStatus('idle'); setEmailInput(''); }}
                className="mt-6 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {/* "No account found" state */}
        {sendStatus === 'not_found' && (
          <div className="mt-10">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-6">
              <p className="text-sm text-zinc-300">
                No account found for <span className="font-medium text-white">{emailInput}</span>.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {stripeLink && (
                  <a
                    href={stripeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white text-center transition-all hover:bg-orange-400"
                  >
                    Get access
                  </a>
                )}
                <button
                  onClick={handleFreeRun}
                  className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-400 hover:border-zinc-500 hover:text-white transition-all"
                >
                  Try a free run
                </button>
                <button
                  onClick={() => { setSendStatus('idle'); setEmailInput(''); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Try a different email
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email input form (idle or error states) */}
        {(sendStatus === 'idle' || sendStatus === 'sending') && (
          <div className="mt-10">
            <label className="block text-xs font-medium text-zinc-400 mb-2">Enter your email to get started</label>
            <input
              type="email"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-0"
              placeholder="you@email.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendLink()}
              autoFocus
            />

            {sendError && (
              <p className="mt-2 text-sm text-red-400">{sendError}</p>
            )}

            <button
              onClick={handleSendLink}
              disabled={!emailInput.trim() || sendStatus === 'sending'}
              className="mt-4 w-full rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {sendStatus === 'sending' ? 'Sending...' : 'Send login link'}
            </button>

            <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
              <button
                onClick={handleFreeRun}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Just try a free run
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
