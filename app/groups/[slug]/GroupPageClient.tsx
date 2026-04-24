'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import { formatXp, SKILLS } from '@/lib/osrs';
import { DEFAULT_RANK_TITLES, RANK_OPTIONS, rankIconPath, getMemberTitle, FIXED_RANK_TITLES } from '@/lib/ranks';

type Tab = 'overview' | 'leaderboard' | 'competitions' | 'activity' | 'manage';
type Period = 'week' | 'month' | 'year' | 'all';

interface Member {
  username: string;
  display_name: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  total_xp: number;
  total_level: number;
  overall_rank: number | null;
  last_fetched_at: string | null;
  rank_slot: number | null;
  rank_icon_id: string | null;
}

interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  is_private: boolean;
  created_by: string;
  discord_webhook_url: string | null;
  banner_url: string | null;
  discord_verified: boolean | null;
  rank_titles: string[] | null;
  rank_icons: (string | null)[] | null;
  members: Member[];
}

interface LeaderboardRow {
  username: string;
  display_name: string;
  total_xp: number;
  total_level: number;
  overall_rank: number | null;
  xp_gained: number;
  role: string;
}

interface Competition {
  id: string;
  name: string;
  metric: string;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  status?: string;
}

interface CompStanding {
  username: string;
  display_name: string;
  xp_gained: number;
}

interface CompDetail extends Competition {
  standings: CompStanding[];
}

interface ActivityEvent {
  id: string;
  event_type: string;
  actor: string;
  target: string | null;
  metadata: Record<string, string> | null;
  created_at: string;
}

interface JoinRequest {
  id: string;
  username: string;
  display_name: string;
  message: string;
  created_at: string;
}

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error ?? 'Failed to load');
  }
  return r.json();
};

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  owner: { label: 'Owner', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  admin: { label: 'Admin', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  member: { label: 'Member', cls: 'bg-white/5 text-slate-400 border-white/10' },
};

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: '1W' },
  { value: 'month', label: '1M' },
  { value: 'year', label: '1Y' },
  { value: 'all', label: 'All' },
];

const SKILL_OPTIONS = SKILLS.map(s => ({ value: s.name.toLowerCase(), label: s.name }));

// Snapshot of current time at module load — used for competition status badges.
// Competitions run for hours/days so a page-load timestamp is accurate enough.
const NOW = Date.now();

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) === 1 ? '' : 's'} ago`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function eventAction(e: ActivityEvent): { icon: string; text: string; cls: string; target?: string } {
  const newRole = e.metadata?.new_role ?? 'admin';
  switch (e.event_type) {
    case 'member_joined':
      return { icon: '↗', text: 'Joined the group', cls: 'text-emerald-400' };
    case 'member_added':
      return { icon: '↗', text: 'Added', cls: 'text-emerald-400', target: e.target ?? undefined };
    case 'member_request_accepted':
      return { icon: '↗', text: 'Request accepted', cls: 'text-emerald-400' };
    case 'member_left':
      return { icon: '↙', text: 'Left the group', cls: 'text-red-400' };
    case 'member_kicked':
      return { icon: '↙', text: 'Kicked', cls: 'text-red-400', target: e.target ?? undefined };
    case 'member_promoted':
      return { icon: '⬆', text: `Promoted to ${newRole}`, cls: 'text-blue-400', target: e.target ?? undefined };
    case 'member_demoted':
      return { icon: '⬇', text: `Demoted to ${newRole}`, cls: 'text-slate-400', target: e.target ?? undefined };
    case 'competition_created':
      return { icon: '🏆', text: `Created: ${e.metadata?.name ?? 'competition'}`, cls: 'text-yellow-400' };
    case 'competition_deleted':
      return { icon: '🗑', text: 'Deleted a competition', cls: 'text-red-400' };
    case 'request_approved':
      return { icon: '✓', text: 'Approved request from', cls: 'text-emerald-400', target: e.target ?? undefined };
    case 'request_denied':
      return { icon: '✗', text: 'Denied request from', cls: 'text-red-400', target: e.target ?? undefined };
    case 'group_updated':
      return { icon: '✎', text: 'Updated group settings', cls: 'text-slate-400' };
    default:
      return { icon: '·', text: e.event_type.replace(/_/g, ' '), cls: 'text-slate-500' };
  }
}

// Milestones
interface Milestone {
  label: string;
  icon: string;
  achieved: boolean;
}

function computeMilestones(members: Member[]): Milestone[] {
  const totalXP = members.reduce((sum, m) => sum + (m.total_xp ?? 0), 0);
  const count = members.length;
  return [
    { label: '5 Members', icon: '👥', achieved: count >= 5 },
    { label: '10 Members', icon: '🏘️', achieved: count >= 10 },
    { label: '25 Members', icon: '🏰', achieved: count >= 25 },
    { label: '50 Members', icon: '⚔️', achieved: count >= 50 },
    { label: '100M Total XP', icon: '💎', achieved: totalXP >= 100_000_000 },
    { label: '500M Total XP', icon: '🌟', achieved: totalXP >= 500_000_000 },
    { label: '1B Total XP', icon: '👑', achieved: totalXP >= 1_000_000_000 },
  ];
}

export default function GroupPageClient({ slug }: { slug: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<Period>('week');
  const [skill, setSkill] = useState('overall');
  const [user, setUser] = useState<{ id: string; email?: string } | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [requestMsg, setRequestMsg] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  // Manage tab state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editWebhook, setEditWebhook] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [editRankTitles, setEditRankTitles] = useState<string[]>(() => [...DEFAULT_RANK_TITLES]);
  const [editRankIcons, setEditRankIcons] = useState<(string | null)[]>(() => Array(27).fill(null));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [addUsername, setAddUsername] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [kickTarget, setKickTarget] = useState<string | null>(null);
  const [settingRank, setSettingRank] = useState<string | null>(null);
  const [openRankDropdown, setOpenRankDropdown] = useState<string | null>(null);
  const [openRankDropdownUpward, setOpenRankDropdownUpward] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Competition create state
  const [compName, setCompName] = useState('');
  const [compMetric, setCompMetric] = useState('overall');
  const [compStart, setCompStart] = useState('');
  const [compEnd, setCompEnd] = useState('');
  const [compCreating, setCompCreating] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);
  const [showCompForm, setShowCompForm] = useState(false);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);

  // Load auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: group, error: groupError, isLoading: groupLoading, mutate: mutateGroup } =
    useSWR<Group>(`/api/groups/${slug}`, fetcher, { revalidateOnFocus: false });

  const { data: leaderboard, isLoading: lbLoading } =
    useSWR<LeaderboardRow[]>(
      tab === 'leaderboard' ? `/api/groups/${slug}/leaderboard?period=${period}&skill=${skill}` : null,
      fetcher,
      { revalidateOnFocus: false }
    );

  const { data: competitions, mutate: mutateComps } =
    useSWR<Competition[]>(
      tab === 'competitions' ? `/api/groups/${slug}/competitions` : null,
      fetcher,
      { revalidateOnFocus: false }
    );

  const { data: compDetail } =
    useSWR<CompDetail>(
      selectedComp ? `/api/groups/${slug}/competitions/${selectedComp}` : null,
      fetcher,
      { revalidateOnFocus: false }
    );

  const { data: events } =
    useSWR<ActivityEvent[]>(
      (tab === 'overview' || tab === 'activity') ? `/api/groups/${slug}/events?limit=50` : null,
      fetcher,
      { revalidateOnFocus: false }
    );

  const { data: joinRequests, mutate: mutateRequests } =
    useSWR<JoinRequest[]>(
      tab === 'manage' ? `/api/groups/${slug}/requests` : null,
      fetcher,
      { revalidateOnFocus: false }
    );

  // Derived: caller's membership
  const [claimedUsername, setClaimedUsername] = useState<string | null>(null);
  useEffect(() => {
    if (!user) { Promise.resolve().then(() => setClaimedUsername(null)); return; }
    // Fetch user's claimed player
    const supabase = createClient();
    supabase.from('players').select('username').eq('claimed_by', user.id).single()
      .then(({ data }) => setClaimedUsername(data?.username ?? null));
  }, [user]);

  const myMembership = group?.members.find(m => m.username === claimedUsername) ?? null;
  const isMember = !!myMembership;
  const isOwnerOrAdmin = myMembership?.role === 'owner' || myMembership?.role === 'admin';

  // Set edit fields when group loads
  useEffect(() => {
    if (group) {
      Promise.resolve().then(() => {
        setEditName(group.name);
        setEditDesc(group.description ?? '');
        setEditWebhook(group.discord_webhook_url ?? '');
        setEditBannerUrl(group.banner_url ?? '');
        const titles = group.rank_titles ?? DEFAULT_RANK_TITLES;
        // Ensure 27 elements, fill missing with defaults
        const normalised = Array.from({ length: 27 }, (_, i) => titles[i] ?? DEFAULT_RANK_TITLES[i]);
        setEditRankTitles(normalised);
        const loadedIcons = group.rank_icons ?? [];
        const normalisedIcons = Array.from({ length: 27 }, (_, i) => loadedIcons[i] ?? null);
        setEditRankIcons(normalisedIcons);
      });
    }
  }, [group]);

  async function handleJoin() {
    setJoining(true);
    setActionError(null);
    try {
      if (group?.is_private) {
        // Submit join request instead
        const r = await fetch(`/api/groups/${slug}/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: requestMsg }),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        setRequestSent(true);
      } else {
        const r = await fetch(`/api/groups/${slug}/join`, { method: 'POST' });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        await mutateGroup();
      }
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to join');
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    setLeaving(true);
    setActionError(null);
    try {
      const r = await fetch(`/api/groups/${slug}/leave`, { method: 'POST' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      if (json.group_deleted) {
        router.push('/groups');
        return;
      }
      await mutateGroup();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to leave');
    } finally {
      setLeaving(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch(`/api/groups/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDesc, discord_webhook_url: editWebhook.trim() || null, rank_titles: editRankTitles, rank_icons: editRankIcons }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      setSaveMsg('Saved!');
      await mutateGroup();
    } catch (e: unknown) {
      setSaveMsg(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addUsername.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const r = await fetch(`/api/groups/${slug}/add-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: addUsername.trim().toLowerCase() }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      setAddUsername('');
      await mutateGroup();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed to add member');
    } finally {
      setAdding(false);
    }
  }

  const handleKick = useCallback(async (username: string) => {
    setKickTarget(username);
    try {
      const r = await fetch(`/api/groups/${slug}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      await mutateGroup();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to kick');
    } finally {
      setKickTarget(null);
    }
  }, [slug, mutateGroup]);

  const handlePromote = useCallback(async (username: string, role: string) => {
    try {
      const r = await fetch(`/api/groups/${slug}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, role }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      await mutateGroup();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to update role');
    }
  }, [slug, mutateGroup]);

  const handleSetRank = useCallback(async (username: string, rankSlot: number | null, rankIconId: string | null) => {
    setSettingRank(username);
    try {
      const r = await fetch(`/api/groups/${slug}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, rank_slot: rankSlot, rank_icon_id: rankIconId }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      await mutateGroup();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to set rank');
    } finally {
      setSettingRank(null);
    }
  }, [slug, mutateGroup]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const r = await fetch(`/api/groups/${slug}`, { method: 'DELETE' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      router.push('/groups');
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete group');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleCreateComp(e: React.FormEvent) {
    e.preventDefault();
    setCompCreating(true);
    setCompError(null);
    try {
      const r = await fetch(`/api/groups/${slug}/competitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: compName,
          metric: compMetric,
          starts_at: new Date(compStart).toISOString(),
          ends_at: new Date(compEnd).toISOString(),
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      setCompName('');
      setCompStart('');
      setCompEnd('');
      setShowCompForm(false);
      await mutateComps();
    } catch (e: unknown) {
      setCompError(e instanceof Error ? e.message : 'Failed to create competition');
    } finally {
      setCompCreating(false);
    }
  }

  async function handleDeleteComp(compId: string) {
    try {
      const r = await fetch(`/api/groups/${slug}/competitions/${compId}`, { method: 'DELETE' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      setSelectedComp(null);
      await mutateComps();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete competition');
    }
  }

  async function handleRequest(requestId: string, action: 'approve' | 'deny') {
    try {
      const r = await fetch(`/api/groups/${slug}/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      await mutateRequests();
      if (action === 'approve') await mutateGroup();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to handle request');
    }
  }

  // Loading state
  if (groupLoading || user === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-10 w-48 bg-[#1e1c2a] rounded-lg animate-pulse mb-6"/>
        <div className="h-32 bg-[#1e1c2a] rounded-2xl animate-pulse"/>
      </div>
    );
  }

  if (groupError || !group) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-2xl font-bold text-white mb-2">Group not found</p>
        <p className="text-slate-400 mb-6">This group may have been deleted or never existed.</p>
        <Link href="/groups" className="text-blue-400 hover:underline">← Back to Groups</Link>
      </div>
    );
  }

  const ownerMember = group.members.find(m => m.role === 'owner');
  const sortedMembers = [...group.members].sort((a, b) => {
    const order = { owner: 0, admin: 1, member: 2 };
    return (order[a.role] - order[b.role]) || b.total_xp - a.total_xp;
  });

  // Aggregate stats
  const totalGroupXP = group.members.reduce((sum, m) => sum + (m.total_xp ?? 0), 0);
  const avgLevel = group.members.length > 0
    ? Math.round(group.members.reduce((sum, m) => sum + (m.total_level ?? 0), 0) / group.members.length)
    : 0;
  const milestones = computeMilestones(group.members);
  const achievedMilestones = milestones.filter(m => m.achieved);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-up">
      {/* Back */}
      <Link href="/groups" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
        </svg>
        All Groups
      </Link>

      {/* Group header */}
      <div
        className="border border-white/[0.07] rounded-2xl p-6 mb-6 shadow-xl overflow-hidden relative"
        style={group.banner_url ? {
          backgroundImage: `linear-gradient(to bottom, rgba(30,28,42,0.55) 0%, rgba(30,28,42,0.92) 60%, #1e1c2a 100%), url(${JSON.stringify(group.banner_url)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : { background: '#1e1c2a' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <h1 className="text-3xl font-extrabold text-white">{group.name}</h1>
              {group.discord_verified && (
                <span title="This group is verified on our Discord server.">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Discord Verified">
                    <circle cx="11" cy="11" r="11" fill="#5865F2" />
                    <path d="M6.5 11.5L9.5 14.5L15.5 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              {group.is_private && (
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">Private</span>
              )}
            </div>
            {group.description && (
              <p className="text-slate-400 text-sm mb-2">{group.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>{group.members.length} {group.members.length === 1 ? 'member' : 'members'}</span>
              {ownerMember && (
                <span>
                  Led by{' '}
                  <Link href={`/player/${ownerMember.username}`} className="text-slate-300 hover:text-white transition-colors">
                    {ownerMember.display_name}
                  </Link>
                </span>
              )}
              <span>Created {timeAgo(group.created_at)}</span>
            </div>
          </div>

          {/* Join / Leave / Request */}
          <div className="flex items-center gap-2">
            {actionError && (
              <p className="text-xs text-red-400">{actionError}</p>
            )}
            {user && !isMember && !requestSent && (
              group.is_private ? (
                <div className="flex flex-col gap-1.5 items-end">
                  <input
                    type="text"
                    value={requestMsg}
                    onChange={e => setRequestMsg(e.target.value)}
                    placeholder="Message (optional)"
                    maxLength={200}
                    className="w-48 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {joining ? 'Requesting...' : 'Request to Join'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {joining ? 'Joining...' : 'Join Group'}
                </button>
              )
            )}
            {user && !isMember && requestSent && (
              <span className="text-xs text-amber-400 font-medium">Request sent!</span>
            )}
            {user && isMember && myMembership?.role !== 'owner' && (
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                {leaving ? 'Leaving...' : 'Leave Group'}
              </button>
            )}
            {!user && (
              <Link href="/auth/login" className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-white/10 rounded-lg transition-colors">
                Sign in to join
              </Link>
            )}
          </div>
        </div>

        {/* Aggregate Stats Panel */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/[0.07]">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-white">{group.members.length}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">Members</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-emerald-400">{formatXp(totalGroupXP)}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">Combined XP</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-blue-400">{avgLevel.toLocaleString()}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">Avg Total Level</p>
          </div>
        </div>

        {/* Milestones */}
        {achievedMilestones.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/[0.07]">
            {achievedMilestones.map(m => (
              <span key={m.label} className="inline-flex items-center gap-1 text-xs bg-white/5 border border-white/10 text-slate-300 px-2.5 py-1 rounded-full">
                <span>{m.icon}</span> {m.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.07]">
        {(['overview', 'competitions', 'leaderboard', 'activity', ...(isOwnerOrAdmin ? ['manage'] : [])] as Tab[]).map(t => {
          const label: Record<Tab, string> = {
            overview: 'Overview',
            competitions: 'Competitions',
            leaderboard: 'Leaderboards',
            activity: 'Activity',
            manage: 'Manage',
          };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                tab === t
                  ? 'text-white border-blue-500'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              {label[t]}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_270px] gap-5">
          {/* Members table */}
          <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl overflow-visible shadow-xl">
            <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">
                Showing all <span className="text-white">{group.members.length}</span> member{group.members.length !== 1 ? 's' : ''} of {group.name}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Player</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right hidden sm:table-cell">Experience</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right hidden md:table-cell">Last updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sortedMembers.map(m => {
                  const badge = ROLE_BADGE[m.role] ?? ROLE_BADGE.member;
                  const initials = (m.display_name || m.username).charAt(0).toUpperCase();
                  const titleLabel = getMemberTitle(group.rank_titles, m.rank_slot, m.role);
                  const roleFallbackIcon = m.role === 'owner'
                    ? (group.rank_icons?.[0] ?? null)
                    : m.role === 'admin'
                      ? (group.rank_icons?.[11] ?? null)
                      : null;
                  const iconId = m.rank_slot
                    ? (group.rank_icons?.[m.rank_slot - 1] ?? m.rank_icon_id ?? null)
                    : (m.rank_icon_id ?? roleFallbackIcon);
                  return (
                    <tr key={m.username} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {initials}
                          </div>
                          <div>
                            <Link
                              href={`/player/${m.username}`}
                              className="font-semibold text-white hover:text-blue-300 transition-colors text-sm leading-tight block"
                            >
                              {m.display_name}
                            </Link>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded border ${m.rank_slot ? 'bg-white/5 text-slate-300 border-white/10' : badge.cls} mt-0.5 inline-flex items-center gap-1`}>
                              {iconId && (
                                <Image src={rankIconPath(iconId)} alt="" width={12} height={12} className="inline-block" unoptimized />
                              )}
                              {titleLabel}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-300 hidden sm:table-cell text-sm">
                        {m.total_xp > 0 ? formatXp(m.total_xp) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500 hidden md:table-cell text-xs">
                        {m.last_fetched_at ? timeAgo(m.last_fetched_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Recent activity sidebar */}
          <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl h-fit">
            <div className="px-4 py-3 border-b border-white/[0.07]">
              <h3 className="text-sm font-bold text-white">Recent activity</h3>
            </div>
            {(!events || events.length === 0) ? (
              <p className="text-xs text-slate-500 text-center py-8">No activity yet.</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {events.slice(0, 12).map(e => {
                  const action = eventAction(e);
                  return (
                    <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#13111e] border border-white/[0.06] flex items-center justify-center text-base shrink-0">
                        🏆
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/player/${e.actor}`}
                            className="text-sm font-bold text-white hover:text-blue-300 transition-colors leading-tight"
                          >
                            {capitalize(e.actor)}
                          </Link>
                          {action.target && (
                            <span className="text-xs text-slate-500">→</span>
                          )}
                          {action.target && (
                            <Link
                              href={`/player/${action.target}`}
                              className="text-sm font-bold text-white hover:text-blue-300 transition-colors leading-tight"
                            >
                              {capitalize(action.target)}
                            </Link>
                          )}
                        </div>
                        <p className={`text-xs mt-0.5 ${action.cls}`}>
                          {action.icon} {action.text}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap shrink-0 ml-2">
                        {timeAgo(e.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {events && events.length > 12 && (
              <button
                onClick={() => setTab('activity')}
                className="w-full px-4 py-3 text-xs text-blue-400 hover:text-blue-300 border-t border-white/[0.07] transition-colors text-center"
              >
                View more →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div>
          {/* Period + Skill selector */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 mr-1">Period:</span>
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    period === p.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#1e1c2a] text-slate-400 hover:text-white border border-white/[0.07]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Skill:</span>
              <select
                value={skill}
                onChange={e => setSkill(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#1e1c2a] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {SKILL_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {lbLoading && (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-[#1e1c2a] rounded-xl animate-pulse"/>)}
            </div>
          )}

          {!lbLoading && leaderboard && (
            <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Player</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                      {period === 'all' ? 'Total XP' : 'XP Gained'}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right hidden sm:table-cell">
                      Total Level
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {leaderboard.map((row, i) => {
                    const podium = i === 0 ? 'text-yellow-300' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500';
                    const member = group.members.find(m => m.username === row.username);
                    const roleFallbackIcon = row.role === 'owner'
                      ? (group.rank_icons?.[0] ?? null)
                      : row.role === 'admin'
                        ? (group.rank_icons?.[11] ?? null)
                        : null;
                    const iconId = member?.rank_slot
                      ? (group.rank_icons?.[member.rank_slot - 1] ?? member.rank_icon_id ?? null)
                      : (member?.rank_icon_id ?? roleFallbackIcon);
                    return (
                      <tr key={row.username} className="hover:bg-white/[0.02] transition-colors">
                        <td className={`px-4 py-3 font-bold text-sm ${podium}`}>{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {iconId && (
                              <Image src={rankIconPath(iconId)} alt="" width={14} height={14} className="inline-block shrink-0" unoptimized />
                            )}
                            <Link
                              href={`/player/${row.username}`}
                              className="font-medium text-white hover:text-blue-300 transition-colors"
                            >
                              {row.display_name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                          {row.xp_gained > 0 ? `+${formatXp(row.xp_gained)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300 hidden sm:table-cell">
                          {row.total_level > 0 ? row.total_level.toLocaleString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No data for this period yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Competitions Tab */}
      {tab === 'competitions' && (
        <div className="space-y-5">
          {/* Create button */}
          {isOwnerOrAdmin && !showCompForm && (
            <button
              onClick={() => setShowCompForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              + New Competition
            </button>
          )}

          {/* Create form */}
          {showCompForm && isOwnerOrAdmin && (
            <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
              <h3 className="text-base font-bold text-white mb-4">Create Competition</h3>
              <form onSubmit={handleCreateComp} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Name</label>
                  <input
                    type="text"
                    value={compName}
                    onChange={e => setCompName(e.target.value)}
                    required
                    maxLength={80}
                    placeholder="Weekend Woodcutting Race"
                    className="w-full max-w-sm rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Skill</label>
                  <select
                    value={compMetric}
                    onChange={e => setCompMetric(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {SKILL_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Start</label>
                    <input
                      type="datetime-local"
                      value={compStart}
                      onChange={e => setCompStart(e.target.value)}
                      required
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">End</label>
                    <input
                      type="datetime-local"
                      value={compEnd}
                      onChange={e => setCompEnd(e.target.value)}
                      required
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {compError && <p className="text-xs text-red-400">{compError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={compCreating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {compCreating ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCompForm(false); setCompError(null); }}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Competition detail */}
          {selectedComp && compDetail && (
            <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{compDetail.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {compDetail.metric.charAt(0).toUpperCase() + compDetail.metric.slice(1)} &middot;{' '}
                    {new Date(compDetail.starts_at).toLocaleDateString()} – {new Date(compDetail.ends_at).toLocaleDateString()}
                    {compDetail.status && (
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                        compDetail.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                        compDetail.status === 'upcoming' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {compDetail.status}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => handleDeleteComp(compDetail.id)}
                      className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedComp(null)}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              </div>

              {/* Standings */}
              {compDetail.standings.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.07] text-left">
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase w-8">#</th>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Player</th>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase text-right">XP Gained</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {compDetail.standings.map((s, i) => {
                      const podium = i === 0 ? 'text-yellow-300' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500';
                      return (
                        <tr key={s.username} className="hover:bg-white/[0.02] transition-colors">
                          <td className={`px-3 py-2 font-bold ${podium}`}>{i + 1}</td>
                          <td className="px-3 py-2">
                            <Link href={`/player/${s.username}`} className="font-medium text-white hover:text-blue-300 transition-colors">
                              {s.display_name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-400">
                            {s.xp_gained > 0 ? `+${formatXp(s.xp_gained)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-500 text-center py-6">No data yet — standings update as snapshots are recorded.</p>
              )}
            </div>
          )}

          {/* Competition list */}
          {!selectedComp && (
            <div className="space-y-3">
              {(competitions ?? []).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">No competitions yet.</p>
              )}
              {(competitions ?? []).map(c => {
                const start = new Date(c.starts_at).getTime();
                const end = new Date(c.ends_at).getTime();
                const status = NOW < start ? 'upcoming' : NOW > end ? 'ended' : 'active';
                const statusCls = status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                  status === 'upcoming' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-500/20 text-slate-400';
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedComp(c.id)}
                    className="w-full text-left bg-[#1e1c2a] border border-white/[0.07] rounded-xl p-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-white">{c.name}</span>
                        <span className="text-xs text-slate-500 ml-2">
                          {c.metric.charAt(0).toUpperCase() + c.metric.slice(1)}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${statusCls}`}>{status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(c.starts_at).toLocaleDateString()} – {new Date(c.ends_at).toLocaleDateString()}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Activity Tab */}
      {tab === 'activity' && (
        <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <h3 className="text-base font-bold text-white">Recent Activity</h3>
          </div>
          {(!events || events.length === 0) ? (
            <p className="text-sm text-slate-500 text-center py-8">No activity recorded yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {events.map(e => {
                const action = eventAction(e);
                return (
                  <div key={e.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#13111e] border border-white/[0.06] flex items-center justify-center text-base shrink-0">
                      🏆
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/player/${e.actor}`}
                          className="text-sm font-bold text-white hover:text-blue-300 transition-colors leading-tight"
                        >
                          {capitalize(e.actor)}
                        </Link>
                        {action.target && (
                          <span className="text-xs text-slate-500">→</span>
                        )}
                        {action.target && (
                          <Link
                            href={`/player/${action.target}`}
                            className="text-sm font-bold text-white hover:text-blue-300 transition-colors leading-tight"
                          >
                            {capitalize(action.target)}
                          </Link>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${action.cls}`}>
                        {action.icon} {action.text}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap shrink-0 ml-2">
                      {timeAgo(e.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Manage Tab */}
      {tab === 'manage' && isOwnerOrAdmin && (
        <div className="space-y-6">
          {/* Settings */}
          <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Group Settings</h3>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={60}
                  required
                  className="w-full max-w-sm rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  maxLength={300}
                  rows={2}
                  className="w-full max-w-sm rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
              {myMembership?.role === 'owner' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Banner Image
                  </label>
                  {/* Preview */}
                  {editBannerUrl && (
                    <div
                      className="mb-2 h-20 max-w-sm rounded-lg border border-white/10 bg-cover bg-center relative group/banner"
                      style={{ backgroundImage: `url(${JSON.stringify(editBannerUrl)})` }}
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          setBannerUploadError(null);
                          setUploadingBanner(true);
                          try {
                            const r = await fetch(`/api/groups/${slug}/banner`, { method: 'DELETE' });
                            const j = await r.json();
                            if (!r.ok) throw new Error(j.error);
                            setEditBannerUrl('');
                            await mutateGroup();
                          } catch (e: unknown) {
                            setBannerUploadError(e instanceof Error ? e.message : 'Failed to remove banner');
                          } finally {
                            setUploadingBanner(false);
                          }
                        }}
                        disabled={uploadingBanner}
                        className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600/80 text-white rounded px-2 py-0.5 text-[10px] font-medium transition-colors opacity-0 group-hover/banner:opacity-100"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {/* File upload */}
                  <label className="flex items-center gap-2 cursor-pointer max-w-sm">
                    <span className="px-3 py-1.5 rounded-lg border border-white/10 bg-black/30 text-xs text-slate-300 hover:border-white/20 transition-colors">
                      {uploadingBanner ? 'Uploading…' : 'Choose file'}
                    </span>
                    <span className="text-xs text-slate-500">JPEG, PNG, WebP or GIF · max 5 MB</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={uploadingBanner}
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setBannerUploadError(null);
                        setUploadingBanner(true);
                        try {
                          const fd = new FormData();
                          fd.append('file', file);
                          const r = await fetch(`/api/groups/${slug}/banner`, { method: 'POST', body: fd });
                          const j = await r.json();
                          if (!r.ok) throw new Error(j.error);
                          setEditBannerUrl(j.banner_url);
                          await mutateGroup();
                        } catch (err: unknown) {
                          setBannerUploadError(err instanceof Error ? err.message : 'Upload failed');
                        } finally {
                          setUploadingBanner(false);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                  {bannerUploadError && (
                    <p className="text-xs text-red-400 mt-1">{bannerUploadError}</p>
                  )}
                </div>
              )}
              {myMembership?.role === 'owner' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Discord Webhook URL
                  </label>
                  <input
                    type="url"
                    value={editWebhook}
                    onChange={e => setEditWebhook(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full max-w-sm rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-600 mt-1">
                    Optional — receive clan updates in Discord. Only visible to the group owner.
                  </p>
                </div>
              )}
              {saveMsg && (
                <p className={`text-sm ${saveMsg === 'Saved!' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {saveMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Rank Titles — owner only */}
          {myMembership?.role === 'owner' && (
            <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
              <h3 className="text-base font-bold text-white mb-1">Rank Titles</h3>
              <div className="space-y-2">
                {Array.from({ length: 27 }, (_, i) => {
                  const slot = i + 1;
                  const isFixed = slot === 1 || slot === 2 || slot === 12;
                  const hasAdvanced = slot >= 3 && slot <= 11;
                  return (
                    <div key={slot} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-6 text-right shrink-0">{slot}</span>
                      {isFixed ? (
                        <span className="flex-1 max-w-xs rounded-lg border border-white/5 bg-black/20 px-3 py-1.5 text-sm text-slate-500 cursor-not-allowed">
                          {FIXED_RANK_TITLES[slot]}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={editRankTitles[i]}
                          onChange={e => {
                            const next = [...editRankTitles];
                            next[i] = e.target.value;
                            setEditRankTitles(next);
                          }}
                          maxLength={50}
                          placeholder={DEFAULT_RANK_TITLES[i]}
                          className="flex-1 max-w-xs rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      )}
                      {/* Icon picker — available for all slots including fixed */}
                      <div className="relative shrink-0">
                        <select
                          value={editRankIcons[i] ?? ''}
                          onChange={e => {
                            const next = [...editRankIcons];
                            next[i] = e.target.value || null;
                            setEditRankIcons(next);
                          }}
                          className="rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[160px]"
                        >
                          <option value="">— no icon —</option>
                          {RANK_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      {!isFixed && (
                        <span className={`text-[10px] shrink-0 ${hasAdvanced ? 'text-yellow-600' : 'text-slate-600'}`}>
                          {hasAdvanced ? '⚔ adv' : 'std'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-600 mt-3">
                Save using the &quot;Save Changes&quot; button in Group Settings above.
              </p>
            </div>
          )}

          {/* Add Member */}
          <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Add Member</h3>
            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="text"
                value={addUsername}
                onChange={e => setAddUsername(e.target.value)}
                placeholder="Player username..."
                className="flex-1 max-w-xs rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={adding || !addUsername.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
            </form>
            {addError && <p className="text-xs text-red-400 mt-2">{addError}</p>}
          </div>

          {/* Join Requests (for private groups) */}
          {group.is_private && (
            <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
              <h3 className="text-base font-bold text-white mb-4">
                Pending Join Requests
                {joinRequests && joinRequests.length > 0 && (
                  <span className="ml-2 text-xs font-normal bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                    {joinRequests.length}
                  </span>
                )}
              </h3>
              {(!joinRequests || joinRequests.length === 0) ? (
                <p className="text-sm text-slate-500">No pending requests.</p>
              ) : (
                <div className="space-y-3">
                  {joinRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between gap-3 py-2 border-b border-white/[0.04] last:border-0">
                      <div>
                        <Link href={`/player/${req.username}`} className="font-medium text-white hover:text-blue-300 transition-colors text-sm">
                          {req.display_name}
                        </Link>
                        {req.message && (
                          <p className="text-xs text-slate-500 mt-0.5">&ldquo;{req.message}&rdquo;</p>
                        )}
                        <p className="text-xs text-slate-600">{timeAgo(req.created_at)}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleRequest(req.id, 'approve')}
                          className="text-xs px-2.5 py-1 rounded text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRequest(req.id, 'deny')}
                          className="text-xs px-2.5 py-1 rounded text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Click-away overlay to close rank dropdown */}
          {openRankDropdown && (
            <div className="fixed inset-0 z-40" onClick={() => { setOpenRankDropdown(null); setOpenRankDropdownUpward(false); }} />
          )}

          {/* Member Management */}
          <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl overflow-visible shadow-xl">
            <div className="px-5 py-4 border-b border-white/[0.07]">
              <h3 className="text-base font-bold text-white">Member Management</h3>
            </div>
            {actionError && (
              <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20">
                <p className="text-sm text-red-400">{actionError}</p>
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Player</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sortedMembers.map(m => {
                  const isMe = m.username === claimedUsername;
                  const isOwner = m.role === 'owner';
                  const badge = ROLE_BADGE[m.role] ?? ROLE_BADGE.member;
                  const titleLabel = getMemberTitle(group.rank_titles, m.rank_slot, m.role);
                  const roleFallbackIcon = m.role === 'owner'
                    ? (group.rank_icons?.[0] ?? null)
                    : m.role === 'admin'
                      ? (group.rank_icons?.[11] ?? null)
                      : null;
                  const iconId = m.rank_slot
                    ? (group.rank_icons?.[m.rank_slot - 1] ?? m.rank_icon_id ?? null)
                    : (m.rank_icon_id ?? roleFallbackIcon);
                  return (
                    <tr key={m.username} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/player/${m.username}`} className="font-medium text-white hover:text-blue-300 transition-colors">
                            {m.display_name}
                          </Link>
                          {isMe && <span className="text-xs text-slate-500">(you)</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isOwnerOrAdmin && !isMe ? (
                          <div className="relative">
                            {/* Trigger button */}
                            <button
                              onClick={e => {
                                const isClosing = openRankDropdown === m.username;
                                if (isClosing) {
                                  setOpenRankDropdown(null);
                                  setOpenRankDropdownUpward(false);
                                  return;
                                }

                                const rect = e.currentTarget.getBoundingClientRect();
                                const estimatedMenuHeight = 272;
                                const belowSpace = window.innerHeight - rect.bottom;
                                const aboveSpace = rect.top;
                                const shouldOpenUpward = belowSpace < estimatedMenuHeight && aboveSpace > belowSpace;

                                setOpenRankDropdownUpward(shouldOpenUpward);
                                setOpenRankDropdown(m.username);
                              }}
                              disabled={settingRank === m.username}
                              className="flex items-center gap-1.5 text-xs bg-[#15131f] border border-white/10 rounded px-1.5 py-1 text-slate-300 disabled:opacity-50 hover:border-white/20 transition-colors max-w-[180px]"
                            >
                              {m.rank_slot && (group.rank_icons?.[m.rank_slot - 1]) && (
                                <Image src={rankIconPath(group.rank_icons[m.rank_slot - 1]!)} alt="" width={12} height={12} unoptimized className="shrink-0" />
                              )}
                              <span className="truncate">
                                {m.rank_slot
                                  ? ((group.rank_titles?.[m.rank_slot - 1]) ?? DEFAULT_RANK_TITLES[m.rank_slot - 1])
                                  : '\u2014 None'}
                              </span>
                              <svg className="w-3 h-3 text-slate-500 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {/* Dropdown panel */}
                            {openRankDropdown === m.username && (
                              <div className={`absolute left-0 z-50 w-52 max-h-64 overflow-y-auto bg-[#15131f] border border-white/10 rounded-lg shadow-xl py-1 ${openRankDropdownUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                                <button
                                  onClick={() => { void handleSetRank(m.username, null, null); setOpenRankDropdown(null); setOpenRankDropdownUpward(false); }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-colors"
                                >
                                  <span className="w-3 h-3 shrink-0" />
                                  &mdash; None (role-based)
                                </button>
                                {Array.from({ length: 27 }, (_, i) => {
                                  const slot = i + 1;
                                  const title = (group.rank_titles?.[i]) ?? DEFAULT_RANK_TITLES[i];
                                  const slotIcon = group.rank_icons?.[i] ?? null;
                                  const isSelected = m.rank_slot === slot;
                                  return (
                                    <button
                                      key={slot}
                                      onClick={() => { void handleSetRank(m.username, slot, slotIcon); setOpenRankDropdown(null); setOpenRankDropdownUpward(false); }}
                                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${isSelected ? 'text-white bg-white/10' : 'text-slate-300 hover:bg-white/5'}`}
                                    >
                                      {slotIcon ? (
                                        <Image src={rankIconPath(slotIcon)} alt="" width={12} height={12} unoptimized className="shrink-0" />
                                      ) : (
                                        <span className="w-3 h-3 shrink-0" />
                                      )}
                                      <span className="truncate">{title}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className={`text-xs px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${m.rank_slot ? 'bg-white/5 text-slate-300 border-white/10' : badge.cls}`}>
                            {iconId && (
                              <Image src={rankIconPath(iconId)} alt="" width={12} height={12} className="inline-block" unoptimized />
                            )}
                            {titleLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isOwner && !isMe && (
                          <div className="flex items-center justify-end gap-2">
                            {/* Promote/Demote (owner only) */}
                            {myMembership?.role === 'owner' && (
                              m.role === 'member' ? (
                                <button
                                  onClick={() => handlePromote(m.username, 'admin')}
                                  className="text-xs px-2 py-1 rounded text-blue-300 hover:bg-blue-500/10 border border-blue-500/20 transition-colors"
                                >
                                  Promote
                                </button>
                              ) : (
                                <button
                                  onClick={() => handlePromote(m.username, 'member')}
                                  className="text-xs px-2 py-1 rounded text-slate-400 hover:bg-white/5 border border-white/10 transition-colors"
                                >
                                  Demote
                                </button>
                              )
                            )}
                            {/* Kick */}
                            <button
                              onClick={() => handleKick(m.username)}
                              disabled={kickTarget === m.username}
                              className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10 border border-red-500/20 disabled:opacity-50 transition-colors"
                            >
                              {kickTarget === m.username ? '...' : 'Remove'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Danger Zone (owner only) */}
          {myMembership?.role === 'owner' && (
            <div className="bg-[#1e1c2a] border border-red-500/20 rounded-2xl p-5 shadow-xl">
              <h3 className="text-base font-bold text-red-400 mb-3">Danger Zone</h3>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors"
                >
                  Delete Group
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-slate-300">Are you sure? This cannot be undone.</p>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
