'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';
import { GAME_MODES, getGameMode, GameModeKey, formatNumber, COUNTRIES } from '@/lib/osrs';
import {
  getClaimCooldownRemainingMs,
  reauthValidUntil,
  REAUTH_WINDOW_MINUTES,
  UNCLAIM_COOLDOWN_HOURS,
} from '@/lib/account-security';
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  type AccountPreferencePayload,
  type SearchModePreference,
} from '@/lib/account-preferences';

type MediaItem = {
  id: string;
  public_url: string;
  created_at: string;
  sort_order: number;
};

type SessionInfo = {
  id: string;
  current: boolean;
  userAgent: string;
  lastSignInAt: string | null;
  expiresAt: string | null;
};

type MfaFactor = {
  id: string;
  factor_type?: string;
  friendly_name?: string;
  status?: string;
};

type AccountProfile = {
  is_admin: boolean;
  timezone: string | null;
  locale: string | null;
  default_search_mode: string | null;
  prefers_compact_numbers: boolean | null;
  notify_milestones: boolean | null;
  notify_competitions: boolean | null;
  notify_updates: boolean | null;
  notify_email: boolean | null;
  notify_discord: boolean | null;
  mfa_enabled: boolean | null;
  last_reauth_at: string | null;
  last_unclaim_at: string | null;
};

interface Props {
  user: { id: string; email: string };
  claimedPlayer: {
    username: string;
    display_name: string;
    game_mode: string;
    total_level: number;
    total_xp: number;
    overall_rank: number;
    claimed_at: string | null;
    country?: string | null;
    cover_screenshot_id?: string | null;
  } | null;
  profile: AccountProfile | null;
  isAdmin: boolean;
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 'N/A';

  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatRemaining(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (!restMinutes) return `${hours}h`;
  return `${hours}h ${restMinutes}m`;
}

const SEARCH_MODE_LABELS: Record<SearchModePreference, string> = {
  smart: 'Smart (best match routing)',
  full: 'Always show full search results',
};

export default function AccountClient({ user, claimedPlayer, profile, isAdmin }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const normalizedProfile = useMemo<AccountPreferencePayload>(() => ({
    timezone: profile?.timezone?.trim() || DEFAULT_ACCOUNT_PREFERENCES.timezone,
    locale: profile?.locale?.trim() || DEFAULT_ACCOUNT_PREFERENCES.locale,
    default_search_mode:
      profile?.default_search_mode === 'full'
        ? 'full'
        : DEFAULT_ACCOUNT_PREFERENCES.default_search_mode,
    prefers_compact_numbers:
      profile?.prefers_compact_numbers ?? DEFAULT_ACCOUNT_PREFERENCES.prefers_compact_numbers,
    notify_milestones: profile?.notify_milestones ?? DEFAULT_ACCOUNT_PREFERENCES.notify_milestones,
    notify_competitions: profile?.notify_competitions ?? DEFAULT_ACCOUNT_PREFERENCES.notify_competitions,
    notify_updates: profile?.notify_updates ?? DEFAULT_ACCOUNT_PREFERENCES.notify_updates,
    notify_email: profile?.notify_email ?? DEFAULT_ACCOUNT_PREFERENCES.notify_email,
    notify_discord: profile?.notify_discord ?? DEFAULT_ACCOUNT_PREFERENCES.notify_discord,
    mfa_enabled: profile?.mfa_enabled ?? DEFAULT_ACCOUNT_PREFERENCES.mfa_enabled,
  }), [profile]);

  const [claimInput, setClaimInput] = useState('');
  const [verificationRank, setVerificationRank] = useState('');
  const [verificationLevel, setVerificationLevel] = useState('');
  const [selectedMode, setSelectedMode] = useState<GameModeKey>(
    (claimedPlayer?.game_mode as GameModeKey) ?? 'regular'
  );
  const [selectedCountry, setSelectedCountry] = useState<string>(claimedPlayer?.country ?? '');
  const [countryLoading, setCountryLoading] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [modeLoading, setModeLoading] = useState(false);
  const [unclaimLoading, setUnclaimLoading] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [unclaimConfirmText, setUnclaimConfirmText] = useState('');
  const [showUnclaimConfirm, setShowUnclaimConfirm] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthUntil, setReauthUntil] = useState<string | null>(
    reauthValidUntil(profile?.last_reauth_at ?? null),
  );
  const [newEmail, setNewEmail] = useState(user.email);
  const [emailLoading, setEmailLoading] = useState(false);
  const [resetPasswordEmailLoading, setResetPasswordEmailLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [globalSignOutLoading, setGlobalSignOutLoading] = useState(false);
  const [preferences, setPreferences] = useState<AccountPreferencePayload>(normalizedProfile);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaMsg, setMediaMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [coverScreenshotId, setCoverScreenshotId] = useState<string | null>(
    claimedPlayer?.cover_screenshot_id ?? null,
  );
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const reauthActive = useMemo(() => {
    if (!reauthUntil) return false;
    return new Date(reauthUntil).getTime() > nowMs;
  }, [reauthUntil, nowMs]);

  const cooldownRemainingMs = useMemo(
    () => getClaimCooldownRemainingMs(profile?.last_unclaim_at ?? null),
    [profile?.last_unclaim_at],
  );

  const unclaimExpectedText = claimedPlayer
    ? `UNLINK ${claimedPlayer.username.toUpperCase()}`
    : '';
  const claimedUsername = claimedPlayer?.username ?? null;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadSessions() {
      setSessionsLoading(true);
      setSessionsError(null);
      try {
        const res = await fetch('/api/account/sessions', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? 'Failed to load sessions');
        }
        if (isCancelled) return;
        setSessions(json.sessions ?? []);
        setReauthUntil((prev) => json.reauthValidUntil ?? prev);
      } catch (error) {
        if (!isCancelled) {
          setSessionsError(error instanceof Error ? error.message : 'Failed to load sessions');
        }
      } finally {
        if (!isCancelled) setSessionsLoading(false);
      }
    }

    void loadSessions();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadMedia() {
      if (!claimedUsername) {
        setMedia([]);
        setCoverScreenshotId(null);
        return;
      }

      setMediaLoading(true);
      try {
        const res = await fetch('/api/account/media', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Failed to load media');
        if (isCancelled) return;
        setMedia(json.screenshots ?? []);
        setCoverScreenshotId(json.coverScreenshotId ?? null);
      } catch (error) {
        if (!isCancelled) {
          setMediaMsg({
            type: 'err',
            text: error instanceof Error ? error.message : 'Failed to load media',
          });
        }
      } finally {
        if (!isCancelled) setMediaLoading(false);
      }
    }

    void loadMedia();
    return () => {
      isCancelled = true;
    };
  }, [claimedUsername]);

  useEffect(() => {
    let isCancelled = false;

    async function loadMfa() {
      setMfaError(null);
      const authMfa = supabase.auth.mfa;

      if (typeof authMfa?.listFactors !== 'function') {
        setMfaError('MFA is not available in this client environment.');
        return;
      }

      const { data, error } = await authMfa.listFactors();
      if (isCancelled) return;
      if (error) {
        setMfaError(error.message);
        return;
      }

      setMfaFactors([...(data?.totp ?? []), ...(data?.phone ?? [])]);
    }

    void loadMfa();
    return () => {
      isCancelled = true;
    };
  }, [supabase.auth]);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setClaimLoading(true);
    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: claimInput.trim(),
        game_mode: selectedMode,
        verification_rank: Number(verificationRank),
        verification_total_level: Number(verificationLevel),
      }),
    });
    const json = await res.json();
    setClaimLoading(false);
    if (!res.ok) { setMsg({ type: 'err', text: json.error }); return; }
    setMsg({ type: 'ok', text: `Profile "${json.username}" claimed!` });
    router.refresh();
  }

  async function handleModeChange(mode: GameModeKey) {
    setSelectedMode(mode);
    setMsg(null);
    setModeLoading(true);
    const res = await fetch('/api/gamemode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_mode: mode }),
    });
    const json = await res.json();
    setModeLoading(false);
    if (!res.ok) { setMsg({ type: 'err', text: json.error }); return; }
    setMsg({ type: 'ok', text: 'Game mode updated.' });
    router.refresh();
  }

  async function handleUnclaim() {
    if (!claimedPlayer) return;
    setMsg(null);
    setUnclaimLoading(true);
    const res = await fetch('/api/unclaim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmText: unclaimConfirmText.trim() }),
    });
    const json = await res.json();
    setUnclaimLoading(false);
    if (!res.ok) { setMsg({ type: 'err', text: json.error }); return; }
    setMsg({ type: 'ok', text: 'Profile unlinked.' });
    setShowUnclaimConfirm(false);
    setUnclaimConfirmText('');
    router.refresh();
  }

  async function handleCountryChange(code: string) {
    setSelectedCountry(code);
    setMsg(null);
    setCountryLoading(true);
    const res = await fetch('/api/country', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: code || null }),
    });
    const json = await res.json();
    setCountryLoading(false);
    if (!res.ok) { setMsg({ type: 'err', text: json.error }); return; }
    setMsg({ type: 'ok', text: code ? 'Country updated.' : 'Country removed.' });
    router.refresh();
  }

  async function handleReauth(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setReauthLoading(true);
    const res = await fetch('/api/account/reauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: reauthPassword }),
    });
    const json = await res.json();
    setReauthLoading(false);
    if (!res.ok) {
      setMsg({ type: 'err', text: json.error ?? 'Verification failed.' });
      return;
    }
    setReauthPassword('');
    setReauthUntil(json.validUntil);
    setMsg({ type: 'ok', text: `Identity verified for ${REAUTH_WINDOW_MINUTES} minutes.` });
  }

  async function handleSecurityChange(action: 'change-email' | 'send-password-reset') {
    setMsg(null);
    if (action === 'change-email') {
      setEmailLoading(true);
    } else {
      setResetPasswordEmailLoading(true);
    }

    const payload = action === 'change-email'
      ? { action, newEmail }
      : { action };

    const res = await fetch('/api/account/security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (action === 'change-email') {
      setEmailLoading(false);
    } else {
      setResetPasswordEmailLoading(false);
    }

    if (!res.ok) {
      setMsg({ type: 'err', text: json.error ?? 'Security update failed.' });
      return;
    }

    if (action === 'change-email') {
      router.refresh();
    }

    setMsg({ type: 'ok', text: json.message ?? 'Security settings updated.' });
  }

  async function handleGlobalSignOut() {
    setGlobalSignOutLoading(true);
    setMsg(null);
    const res = await fetch('/api/account/sessions', { method: 'DELETE' });
    const json = await res.json();
    setGlobalSignOutLoading(false);
    if (!res.ok) {
      setMsg({ type: 'err', text: json.error ?? 'Failed to sign out all sessions.' });
      return;
    }
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  async function savePreferences() {
    setPreferencesLoading(true);
    setMsg(null);
    const res = await fetch('/api/account/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    });
    const json = await res.json();
    setPreferencesLoading(false);
    if (!res.ok) {
      setMsg({ type: 'err', text: json.error ?? 'Failed to save preferences.' });
      return;
    }
    setPreferences(json.preferences ?? preferences);
    setMsg({ type: 'ok', text: 'Account preferences saved.' });
  }

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length || !claimedPlayer) return;

    setMediaMsg(null);
    setMediaLoading(true);

    let uploaded = 0;
    for (const file of files) {
      const form = new FormData();
      form.append('screenshot', file);
      const res = await fetch(`/api/player/${encodeURIComponent(claimedPlayer.username)}/screenshot`, {
        method: 'POST',
        body: form,
      });
      if (res.ok) uploaded += 1;
    }

    const refreshRes = await fetch('/api/account/media', { cache: 'no-store' });
    const refreshJson = await refreshRes.json();
    setMediaLoading(false);

    if (refreshRes.ok) {
      setMedia(refreshJson.screenshots ?? []);
      setCoverScreenshotId(refreshJson.coverScreenshotId ?? null);
      setMediaMsg({ type: 'ok', text: `${uploaded} screenshot${uploaded === 1 ? '' : 's'} uploaded.` });
    } else {
      setMediaMsg({ type: 'err', text: refreshJson.error ?? 'Failed to refresh media.' });
    }

    router.refresh();
  }

  async function handleMediaDelete(id: string) {
    if (!claimedPlayer) return;
    setMediaLoading(true);
    setMediaMsg(null);

    const res = await fetch(
      `/api/player/${encodeURIComponent(claimedPlayer.username)}/screenshot?id=${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    const json = await res.json();

    if (!res.ok) {
      setMediaLoading(false);
      setMediaMsg({ type: 'err', text: json.error ?? 'Failed to delete screenshot.' });
      return;
    }

    const refreshRes = await fetch('/api/account/media', { cache: 'no-store' });
    const refreshJson = await refreshRes.json();
    setMediaLoading(false);
    if (refreshRes.ok) {
      setMedia(refreshJson.screenshots ?? []);
      setCoverScreenshotId(refreshJson.coverScreenshotId ?? null);
      setMediaMsg({ type: 'ok', text: 'Screenshot removed.' });
    }
  }

  async function handleSetCover(id: string | null) {
    setMediaLoading(true);
    const res = await fetch('/api/account/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenshotId: id }),
    });
    const json = await res.json();
    setMediaLoading(false);
    if (!res.ok) {
      setMediaMsg({ type: 'err', text: json.error ?? 'Failed to set cover.' });
      return;
    }
    setCoverScreenshotId(json.coverScreenshotId ?? null);
    setMediaMsg({ type: 'ok', text: id ? 'Cover image updated.' : 'Cover image cleared.' });
    router.refresh();
  }

  async function moveMedia(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= media.length) return;

    const next = [...media];
    const tmp = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = tmp;

    setMedia(next);
    setMediaLoading(true);

    const res = await fetch('/api/account/media', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: next.map((item) => item.id) }),
    });
    const json = await res.json();
    setMediaLoading(false);

    if (!res.ok) {
      setMediaMsg({ type: 'err', text: json.error ?? 'Failed to reorder screenshots.' });
      router.refresh();
      return;
    }

    setMediaMsg({ type: 'ok', text: 'Screenshot order updated.' });
  }

  async function startMfaSetup() {
    setMfaLoading(true);
    setMfaError(null);
    const authMfa = supabase.auth.mfa;

    if (typeof authMfa?.enroll !== 'function') {
      setMfaLoading(false);
      setMfaError('MFA setup is not available in this client environment.');
      return;
    }

    const { data, error } = await authMfa.enroll({
      factorType: 'totp',
      friendlyName: 'FeroxStats Account',
    });
    setMfaLoading(false);

    if (error) {
      setMfaError(error.message);
      return;
    }

    setMfaFactorId(data?.id ?? null);
    setMfaQrCode(data?.totp?.qr_code ?? null);
    setMfaCode('');
  }

  async function verifyMfaSetup() {
    if (!mfaFactorId || !mfaCode.trim()) return;
    setMfaLoading(true);
    setMfaError(null);

    const authMfa = supabase.auth.mfa;

    if (typeof authMfa?.challenge !== 'function' || typeof authMfa?.verify !== 'function') {
      setMfaLoading(false);
      setMfaError('MFA verification is not available in this client environment.');
      return;
    }

    const { data: challengeData, error: challengeError } = await authMfa.challenge({ factorId: mfaFactorId });
    if (challengeError || !challengeData?.id) {
      setMfaLoading(false);
      setMfaError(challengeError?.message ?? 'Failed to create MFA challenge.');
      return;
    }

    const { error: verifyError } = await authMfa.verify({
      factorId: mfaFactorId,
      challengeId: challengeData.id,
      code: mfaCode.trim(),
    });

    if (verifyError) {
      setMfaLoading(false);
      setMfaError(verifyError.message);
      return;
    }

    if (authMfa.listFactors) {
      const { data } = await authMfa.listFactors();
      setMfaFactors([...(data?.totp ?? []), ...(data?.phone ?? [])]);
    }

    await fetch('/api/account/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfa_enabled: true }),
    });

    setMfaLoading(false);
    setMfaCode('');
    setMfaQrCode(null);
    setMfaFactorId(null);
    setMsg({ type: 'ok', text: 'MFA enabled successfully.' });
  }

  async function disableMfaFactor(factorId: string) {
    setMfaLoading(true);
    setMfaError(null);

    const authMfa = supabase.auth.mfa;

    if (typeof authMfa?.unenroll !== 'function') {
      setMfaLoading(false);
      setMfaError('MFA disable is not available in this client environment.');
      return;
    }

    const { error } = await authMfa.unenroll({ factorId });
    if (error) {
      setMfaLoading(false);
      setMfaError(error.message);
      return;
    }

    let nextFactors: MfaFactor[] = [];
    if (authMfa.listFactors) {
      const { data } = await authMfa.listFactors();
      nextFactors = [...(data?.totp ?? []), ...(data?.phone ?? [])];
      setMfaFactors(nextFactors);
    }

    await fetch('/api/account/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfa_enabled: nextFactors.length > 0 }),
    });

    setMfaLoading(false);
    setMsg({ type: 'ok', text: 'MFA factor removed.' });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const gm = getGameMode(claimedPlayer?.game_mode ?? 'regular');

  return (
    <main className="flex-1 max-w-2xl mx-auto px-4 py-10 w-full animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-1">My Account</h1>
          <p className="text-slate-400 text-sm">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link href="/admin" className="text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors">
              Admin Panel
            </Link>
          )}
          <button onClick={handleSignOut} className="text-xs font-semibold bg-white/[0.05] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08] px-3 py-1.5 rounded-lg transition-colors">
            Sign Out
          </button>
        </div>
      </div>

      {/* Status message */}
      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm border ${
          msg.type === 'ok'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>{msg.text}</div>
      )}

      {/* Claimed profile card */}
      {claimedPlayer ? (
        <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 mb-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-900 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-900/40">
              {claimedPlayer.display_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">{claimedPlayer.display_name}</p>
              <span className={`text-xs font-semibold ${gm.color} flex items-center gap-1`}>
                {gm.emoji && (
                  <Image
                    src={gm.emoji}
                    width={16}
                    height={16}
                    className="inline-block h-4 w-4"
                    alt=""
                    unoptimized
                  />
                )}
                {gm.label}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link href={`/player/${encodeURIComponent(claimedPlayer.username)}`} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                View Profile →
              </Link>
              <button
                onClick={() => setShowUnclaimConfirm((prev) => !prev)}
                className="text-xs font-semibold bg-white/[0.04] border border-white/[0.08] text-slate-500 hover:text-red-400 hover:border-red-500/30 px-2.5 py-1 rounded-lg transition-colors"
              >
                {showUnclaimConfirm ? 'Cancel' : 'Unlink'}
              </button>
            </div>
          </div>

          {showUnclaimConfirm && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-xs text-red-300 mb-2">
                Type <span className="font-bold">{unclaimExpectedText}</span> to confirm unlink.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={unclaimConfirmText}
                  onChange={(e) => setUnclaimConfirmText(e.target.value)}
                  placeholder={unclaimExpectedText}
                  className="bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500/50"
                />
                <button
                  onClick={handleUnclaim}
                  disabled={unclaimLoading || unclaimConfirmText.trim() !== unclaimExpectedText}
                  className="text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white px-3 py-2 rounded-lg transition-colors"
                >
                  {unclaimLoading ? 'Unlinking…' : 'Confirm Unlink'}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-red-200/80">
                Unlink cooldown: {UNCLAIM_COOLDOWN_HOURS} hours before claiming a new profile.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 text-center mb-5">
            <div className="bg-[#17151f] rounded-lg px-3 py-2">
              <p className="text-lg font-extrabold text-white">{formatNumber(claimedPlayer.total_level)}</p>
              <p className="text-xs text-slate-500">Total Level</p>
            </div>
            <div className="bg-[#17151f] rounded-lg px-3 py-2">
              <p className="text-lg font-extrabold text-white">{claimedPlayer.overall_rank > 0 ? `#${formatNumber(claimedPlayer.overall_rank)}` : '—'}</p>
              <p className="text-xs text-slate-500">Server Rank</p>
            </div>
            <div className="bg-[#17151f] rounded-lg px-3 py-2">
              <p className="text-lg font-extrabold text-white">{gm.combatXp}x / {gm.skillingXp}x</p>
              <p className="text-xs text-slate-500">XP Rates</p>
            </div>
          </div>

          {/* Game mode selector */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Game Mode {modeLoading && <span className="text-slate-600">(saving…)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {GAME_MODES.map(m => (
                <button
                  key={m.key}
                  onClick={() => handleModeChange(m.key)}
                  disabled={modeLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    selectedMode === m.key
                      ? 'bg-emerald-600/30 border-emerald-500/50 text-white'
                      : 'bg-[#17151f] border-white/[0.06] text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  {m.emoji && (
                    <Image
                      src={m.emoji}
                      width={16}
                      height={16}
                      className="mr-1 inline-block h-4 w-4"
                      alt=""
                      unoptimized
                    />
                  )}
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2">
              {gm.combatXp}x Combat · {gm.skillingXp}x Skilling
            </p>
          </div>

          {/* Country selector */}
          <div className="mt-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Country {countryLoading && <span className="text-slate-600">(saving…)</span>}
            </p>
            <div className="flex items-center gap-3">
              {selectedCountry && (
                <Image
                  src={`https://flagcdn.com/w20/${selectedCountry.toLowerCase()}.png`}
                  width={20}
                  height={15}
                  alt={COUNTRIES.find(c => c.code === selectedCountry)?.name ?? selectedCountry}
                  title={COUNTRIES.find(c => c.code === selectedCountry)?.name}
                  className="rounded-sm object-cover shrink-0"
                  unoptimized
                />
              )}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  placeholder={selectedCountry ? (COUNTRIES.find(c => c.code === selectedCountry)?.name ?? 'Search country…') : 'Search country…'}
                  className="w-full bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition text-sm"
                />
                {countrySearch && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-[#1e1c2a] border border-white/[0.10] rounded-lg shadow-xl">
                    {COUNTRIES.filter(c =>
                      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                      c.code.toLowerCase().includes(countrySearch.toLowerCase())
                    ).map(c => (
                      <button
                        key={c.code}
                        type="button"
                        disabled={countryLoading}
                        onClick={() => { handleCountryChange(c.code); setCountrySearch(''); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06] text-left transition-colors"
                      >
                        <Image
                          src={`https://flagcdn.com/w20/${c.code.toLowerCase()}.png`}
                          width={20}
                          height={15}
                          alt={c.name}
                          className="rounded-sm object-cover shrink-0"
                          unoptimized
                        />
                        <span>{c.name}</span>
                      </button>
                    ))}
                    {COUNTRIES.filter(c =>
                      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                      c.code.toLowerCase().includes(countrySearch.toLowerCase())
                    ).length === 0 && (
                      <p className="px-3 py-2 text-sm text-slate-500">No results</p>
                    )}
                  </div>
                )}
              </div>
              {selectedCountry && (
                <button
                  type="button"
                  disabled={countryLoading}
                  onClick={() => { handleCountryChange(''); setCountrySearch(''); }}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Claim form */
        <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 mb-6 shadow-xl">
          <h2 className="text-sm font-bold text-white mb-1">Claim Your Profile</h2>
          <p className="text-xs text-slate-500 mb-4">
            Link your Ferox.ps username to this account to set your game mode badge.
            The player must have been searched on FeroxStats at least once.
          </p>
          {cooldownRemainingMs > 0 && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Claim cooldown active. You can claim again in {formatRemaining(cooldownRemainingMs)}.
            </div>
          )}
          <form onSubmit={handleClaim} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Your In-game Name</label>
              <input
                type="text" required value={claimInput} onChange={e => setClaimInput(e.target.value)}
                placeholder="e.g. Hexae"
                className="w-full bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Game Mode</label>
              <div className="flex flex-wrap gap-2">
                {GAME_MODES.map(m => (
                  <button
                    key={m.key} type="button"
                    onClick={() => setSelectedMode(m.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selectedMode === m.key
                        ? 'bg-emerald-600/30 border-emerald-500/50 text-white'
                        : 'bg-[#17151f] border-white/[0.06] text-slate-400 hover:border-white/20 hover:text-slate-200'
                    }`}
                  >
                    {m.emoji && (
                      <Image
                        src={m.emoji}
                        width={16}
                        height={16}
                        className="mr-1 inline-block h-4 w-4"
                        alt=""
                        unoptimized
                      />
                    )}
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Selected: {getGameMode(selectedMode).combatXp}x Combat · {getGameMode(selectedMode).skillingXp}x Skilling
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Verification Rank</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={verificationRank}
                  onChange={(e) => setVerificationRank(e.target.value)}
                  placeholder="e.g. 214"
                  className="w-full bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Verification Total Level</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={verificationLevel}
                  onChange={(e) => setVerificationLevel(e.target.value)}
                  placeholder="e.g. 2277"
                  className="w-full bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition text-sm"
                />
              </div>
            </div>

            {!reauthActive && (
              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                Security verification required before claiming. Use Security Center below to verify your password.
              </p>
            )}

            <button
              type="submit"
              disabled={claimLoading || !reauthActive || cooldownRemainingMs > 0}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/30 text-sm"
            >
              {claimLoading ? 'Claiming…' : 'Claim Profile'}
            </button>
          </form>
        </div>
      )}

      {/* Security Center */}
      <section className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 mb-6 shadow-xl">
        <h2 className="text-sm font-bold text-white mb-3">Security Center</h2>

        <div className="rounded-xl border border-white/[0.08] bg-[#17151f] p-4 mb-4">
          <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Step-Up Verification</p>
          <p className="text-xs text-slate-500 mb-3">
            {reauthActive
              ? `Verified until ${new Date(reauthUntil ?? '').toLocaleTimeString()}`
              : 'Sensitive actions require password verification.'}
          </p>
          <form onSubmit={handleReauth} className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              placeholder="Current password"
              className="bg-[#0f0d17] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              type="submit"
              disabled={reauthLoading || !reauthPassword.trim()}
              className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white px-3 py-2 rounded-lg transition-colors"
            >
              {reauthLoading ? 'Verifying…' : 'Verify Password'}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl border border-white/[0.08] bg-[#17151f] p-4">
            <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Change Email</p>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-[#0f0d17] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              type="button"
              disabled={!reauthActive || emailLoading || !newEmail.trim()}
              onClick={() => void handleSecurityChange('change-email')}
              className="mt-2 text-xs font-semibold bg-sky-700 hover:bg-sky-600 disabled:opacity-60 text-white px-3 py-2 rounded-lg transition-colors"
            >
              {emailLoading ? 'Updating…' : 'Update Email'}
            </button>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#17151f] p-4">
            <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Reset Password</p>
            <p className="text-xs text-slate-500 mb-2">
              Send a reset link and complete the password update from the email flow.
            </p>
            <button
              type="button"
              disabled={!reauthActive || resetPasswordEmailLoading}
              onClick={() => void handleSecurityChange('send-password-reset')}
              className="mt-2 text-xs font-semibold bg-sky-700 hover:bg-sky-600 disabled:opacity-60 text-white px-3 py-2 rounded-lg transition-colors"
            >
              {resetPasswordEmailLoading ? 'Sending…' : 'Send Reset Email'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#17151f] p-4 mb-4">
          <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Multi-Factor Authentication</p>
          {mfaError && <p className="text-xs text-red-400 mb-2">{mfaError}</p>}
          {mfaFactors.length > 0 ? (
            <div className="space-y-2">
              {mfaFactors.map((factor) => (
                <div key={factor.id} className="flex items-center justify-between rounded-lg bg-[#0f0d17] border border-white/[0.08] px-3 py-2">
                  <div>
                    <p className="text-xs text-slate-200">{factor.friendly_name || factor.factor_type || 'MFA factor'}</p>
                    <p className="text-[11px] text-slate-500">{factor.status || 'active'}</p>
                  </div>
                  <button
                    type="button"
                    disabled={mfaLoading}
                    onClick={() => void disableMfaFactor(factor.id)}
                    className="text-xs font-semibold bg-red-600/90 hover:bg-red-500 disabled:opacity-60 text-white px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 mb-2">No MFA factors enrolled.</p>
          )}

          {!mfaQrCode ? (
            <button
              type="button"
              onClick={() => void startMfaSetup()}
              disabled={mfaLoading}
              className="mt-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white px-3 py-2 rounded-lg transition-colors"
            >
              {mfaLoading ? 'Preparing…' : 'Enable TOTP MFA'}
            </button>
          ) : (
            <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#0f0d17] p-3">
              <p className="text-xs text-slate-300 mb-2">Scan this QR code in your authenticator app, then enter the 6-digit code.</p>
              <div
                className="mb-3 inline-block rounded-md bg-white p-2"
                dangerouslySetInnerHTML={{ __html: mfaQrCode }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="123456"
                  className="bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  type="button"
                  onClick={() => void verifyMfaSetup()}
                  disabled={mfaLoading || !mfaCode.trim()}
                  className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white px-3 py-2 rounded-lg transition-colors"
                >
                  {mfaLoading ? 'Verifying…' : 'Verify & Enable'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#17151f] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Active Sessions</p>
            <button
              type="button"
              onClick={handleGlobalSignOut}
              disabled={globalSignOutLoading}
              className="text-xs font-semibold bg-red-600/90 hover:bg-red-500 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {globalSignOutLoading ? 'Signing out…' : 'Sign Out All Devices'}
            </button>
          </div>
          {sessionsError && <p className="text-xs text-red-400 mb-2">{sessionsError}</p>}
          {sessionsLoading ? (
            <p className="text-xs text-slate-500">Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-slate-500">No active session details available.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-lg border border-white/[0.08] bg-[#0f0d17] px-3 py-2">
                  <p className="text-xs text-slate-200">
                    {session.current ? 'Current session' : 'Session'} · {session.userAgent}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Last sign-in: {session.lastSignInAt ? formatRelativeTime(session.lastSignInAt) : 'unknown'}
                    {session.expiresAt ? ` · Expires ${new Date(session.expiresAt).toLocaleString()}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Preferences */}
      <section className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 mb-6 shadow-xl">
        <h2 className="text-sm font-bold text-white mb-3">Preferences & Notifications</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Timezone</label>
            <input
              type="text"
              value={preferences.timezone}
              onChange={(e) => setPreferences((prev) => ({ ...prev, timezone: e.target.value }))}
              placeholder="e.g. UTC"
              className="w-full bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Locale</label>
            <input
              type="text"
              value={preferences.locale}
              onChange={(e) => setPreferences((prev) => ({ ...prev, locale: e.target.value }))}
              placeholder="e.g. en-US"
              className="w-full bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Default Search Mode</label>
            <select
              value={preferences.default_search_mode}
              onChange={(e) => setPreferences((prev) => ({
                ...prev,
                default_search_mode: e.target.value as SearchModePreference,
              }))}
              className="w-full bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500/50 text-sm"
            >
              {(['smart', 'full'] as const).map((mode) => (
                <option key={mode} value={mode}>{SEARCH_MODE_LABELS[mode]}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 mt-6 md:mt-0">
            <input
              type="checkbox"
              checked={preferences.prefers_compact_numbers}
              onChange={(e) => setPreferences((prev) => ({
                ...prev,
                prefers_compact_numbers: e.target.checked,
              }))}
              className="h-4 w-4 rounded border-white/20 bg-[#17151f]"
            />
            Prefer compact number formatting
          </label>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#17151f] p-4 mb-4">
          <p className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">Notifications</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.notify_milestones}
                onChange={(e) => setPreferences((prev) => ({ ...prev, notify_milestones: e.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-[#0f0d17]"
              />
              Milestone alerts
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.notify_competitions}
                onChange={(e) => setPreferences((prev) => ({ ...prev, notify_competitions: e.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-[#0f0d17]"
              />
              Competition alerts
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.notify_updates}
                onChange={(e) => setPreferences((prev) => ({ ...prev, notify_updates: e.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-[#0f0d17]"
              />
              Update post alerts
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.notify_email}
                onChange={(e) => setPreferences((prev) => ({ ...prev, notify_email: e.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-[#0f0d17]"
              />
              Email notifications
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.notify_discord}
                onChange={(e) => setPreferences((prev) => ({ ...prev, notify_discord: e.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-[#0f0d17]"
              />
              Discord notifications
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void savePreferences()}
          disabled={preferencesLoading}
          className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white px-3 py-2 rounded-lg transition-colors"
        >
          {preferencesLoading ? 'Saving…' : 'Save Preferences'}
        </button>
      </section>

      {/* Media Manager */}
      {claimedPlayer && (
        <section className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 mb-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-white">Media Manager</h2>
            <label className={`text-xs font-semibold bg-sky-700 hover:bg-sky-600 text-white px-3 py-2 rounded-lg transition-colors cursor-pointer ${mediaLoading ? 'opacity-60 pointer-events-none' : ''}`}>
              Upload Screenshots
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="sr-only"
                onChange={handleMediaUpload}
                disabled={mediaLoading}
              />
            </label>
          </div>

          {mediaMsg && (
            <div className={`mb-3 px-3 py-2 rounded-lg text-xs border ${
              mediaMsg.type === 'ok'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>{mediaMsg.text}</div>
          )}

          {mediaLoading && media.length === 0 ? (
            <p className="text-xs text-slate-500">Loading media…</p>
          ) : media.length === 0 ? (
            <p className="text-xs text-slate-500">No screenshots uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {media.map((item, index) => (
                <div key={item.id} className="rounded-xl border border-white/[0.08] bg-[#17151f] overflow-hidden">
                  <div className="relative aspect-video">
                    <Image
                      src={item.public_url}
                      alt={`Screenshot ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    {coverScreenshotId === item.id && (
                      <span className="absolute left-2 top-2 rounded-md border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-300">
                        Cover
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => void moveMedia(index, -1)}
                      disabled={index === 0 || mediaLoading}
                      className="text-[11px] font-semibold bg-white/[0.05] hover:bg-white/[0.08] disabled:opacity-50 text-slate-300 px-2 py-1 rounded"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveMedia(index, 1)}
                      disabled={index === media.length - 1 || mediaLoading}
                      className="text-[11px] font-semibold bg-white/[0.05] hover:bg-white/[0.08] disabled:opacity-50 text-slate-300 px-2 py-1 rounded"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSetCover(item.id)}
                      disabled={coverScreenshotId === item.id || mediaLoading}
                      className="text-[11px] font-semibold bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white px-2 py-1 rounded"
                    >
                      Set Cover
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMediaDelete(item.id)}
                      disabled={mediaLoading}
                      className="text-[11px] font-semibold bg-red-700/80 hover:bg-red-600 disabled:opacity-50 text-white px-2 py-1 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <p className="text-xs text-slate-600 mb-2">
        Last re-auth: {formatRelativeTime(profile?.last_reauth_at)}
        {profile?.last_unclaim_at ? ` | Last unlink: ${formatRelativeTime(profile.last_unclaim_at)}` : ''}
      </p>
    </main>
  );
}
