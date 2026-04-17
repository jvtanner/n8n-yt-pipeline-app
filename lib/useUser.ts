'use client';

import { useState, useEffect, useCallback } from 'react';

export interface VoiceProfile {
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

export interface UserProfile {
  email: string;
  creatorName: string;
  voiceProfile: VoiceProfile | null;
  ideaBank: unknown[];
  youtubeChannelId: string;
  youtubeChannelUrl: string;
  freeRunUsed: boolean;
}

const CACHE_KEY = 'ytPipelineUserCache';

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data: UserProfile = await res.json();
          if (!cancelled) {
            setUser(data);
            setIsGuest(false);
            // Cache in localStorage
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          }
        } else if (res.status === 401) {
          if (!cancelled) {
            setUser(null);
            setIsGuest(true);
          }
        }
      } catch {
        // Network error — try cache
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached && !cancelled) {
          try {
            setUser(JSON.parse(cached));
            setIsGuest(false);
          } catch {
            setIsGuest(true);
          }
        } else if (!cancelled) {
          setIsGuest(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUser();
    return () => { cancelled = true; };
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem(CACHE_KEY);
    setUser(null);
    setIsGuest(true);
  }, []);

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error('Failed to update profile');

    // Update local state
    setUser((prev) => prev ? { ...prev, ...data } : prev);

    // Update cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ...parsed, ...data }));
      } catch { /* ignore */ }
    }
  }, []);

  return {
    user,
    email: user?.email ?? null,
    loading,
    isGuest,
    logout,
    updateProfile,
  };
}
