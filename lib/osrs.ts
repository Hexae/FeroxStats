// OSRS Skill metadata
export const SKILLS = [
  { id: 0,  name: 'Overall',      icon: 'Stats_icon' },
  { id: 1,  name: 'Attack',       icon: 'Attack_icon' },
  { id: 2,  name: 'Defence',      icon: 'Defence_icon' },
  { id: 3,  name: 'Strength',     icon: 'Strength_icon' },
  { id: 4,  name: 'Hitpoints',    icon: 'Hitpoints_icon' },
  { id: 5,  name: 'Ranged',       icon: 'Ranged_icon' },
  { id: 6,  name: 'Prayer',       icon: 'Prayer_icon' },
  { id: 7,  name: 'Magic',        icon: 'Magic_icon' },
  { id: 8,  name: 'Cooking',      icon: 'Cooking_icon' },
  { id: 9,  name: 'Woodcutting',  icon: 'Woodcutting_icon' },
  { id: 10, name: 'Fletching',    icon: 'Fletching_icon' },
  { id: 11, name: 'Fishing',      icon: 'Fishing_icon' },
  { id: 12, name: 'Firemaking',   icon: 'Firemaking_icon' },
  { id: 13, name: 'Crafting',     icon: 'Crafting_icon' },
  { id: 14, name: 'Smithing',     icon: 'Smithing_icon' },
  { id: 15, name: 'Mining',       icon: 'Mining_icon' },
  { id: 16, name: 'Herblore',     icon: 'Herblore_icon' },
  { id: 17, name: 'Agility',      icon: 'Agility_icon' },
  { id: 18, name: 'Thieving',     icon: 'Thieving_icon' },
  { id: 19, name: 'Slayer',       icon: 'Slayer_icon' },
  { id: 20, name: 'Farming',      icon: 'Farming_icon' },
  { id: 21, name: 'Runecraft',    icon: 'Runecraft_icon' },
  { id: 22, name: 'Hunter',       icon: 'Hunter_icon' },
  { id: 23, name: 'Construction', icon: 'Construction_icon' },
];

export function getSkillIcon(iconName: string) {
  return `https://oldschool.runescape.wiki/images/${iconName}.png`;
}

export function formatXp(xp: number | string): string {
  const n = typeof xp === 'string' ? parseInt(xp) : xp;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

// Virtual level — compute level beyond 99 based on XP (up to 126).
// Uses the standard OSRS XP formula.
export function virtualLevel(xp: number | string): number {
  const n = typeof xp === 'string' ? parseInt(xp) : xp;
  if (isNaN(n) || n < 0) return 1;
  let pts = 0;
  for (let lvl = 1; lvl <= 126; lvl++) {
    pts += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    if (Math.floor(pts / 4) > n) return lvl;
  }
  return 126;
}

export interface SkillData {
  id: number;
  name: string;
  rank: number;
  level: number;
  xp: string;
}

// ── Game Mode definitions ─────────────────────────────────────────────────────
export type GameModeKey =
  | 'regular' | 'ironman' | 'hardcore_ironman' | 'elite_ironman'
  | 'elite_hardcore_ironman' | 'ultimate_ironman' | 'realism'
  | 'group_ironman' | 'hardcore_group_ironman' | 'realism_group_ironman'
  | 'unranked_group_ironman' | 'twinbound';

export interface GameMode {
  key: GameModeKey;
  label: string;
  emoji: string;
  combatXp: number;    // x multiplier
  skillingXp: number;  // x multiplier
  isIronman: boolean;
  color: string;       // Tailwind text color class
}

export const GAME_MODES: GameMode[] = [
  { key: 'regular',               label: 'Regular',                emoji: '',  combatXp: 800, skillingXp: 25,  isIronman: false, color: 'text-slate-300' },
  { key: 'realism',               label: 'Realism',                emoji: '/icons/ranks/realism.webp',  combatXp: 10,  skillingXp: 10,  isIronman: false, color: 'text-cyan-400' },
  { key: 'ironman',               label: 'Ironman',                emoji: '/icons/ranks/ironman.webp',  combatXp: 80,  skillingXp: 25,  isIronman: true,  color: 'text-slate-400' },
  { key: 'hardcore_ironman',      label: 'Hardcore Ironman',       emoji: '/icons/ranks/hardcore_ironman.webp',  combatXp: 80,  skillingXp: 25,  isIronman: true,  color: 'text-red-400' },
  { key: 'elite_ironman',         label: 'Elite Ironman',          emoji: '/icons/ranks/elite_ironman.webp',  combatXp: 10,  skillingXp: 10,  isIronman: true,  color: 'text-red-500' },
  { key: 'elite_hardcore_ironman',label: 'Elite Hardcore Ironman', emoji: '/icons/ranks/elite_hardcore_ironman.webp',  combatXp: 10,  skillingXp: 10,  isIronman: true,  color: 'text-orange-400' },
  { key: 'ultimate_ironman',      label: 'Ultimate Ironman',       emoji: '/icons/ranks/ultimate_ironman.webp',  combatXp: 80,  skillingXp: 25,  isIronman: true,  color: 'text-purple-400' },
  { key: 'group_ironman',         label: 'Group Ironman',          emoji: '/icons/ranks/group_ironman.webp',  combatXp: 80,  skillingXp: 25,  isIronman: true,  color: 'text-green-400' },
  { key: 'hardcore_group_ironman',label: 'Hardcore Group Ironman', emoji: '/icons/ranks/hardcore_group_ironman.webp',  combatXp: 80,  skillingXp: 25,  isIronman: true,  color: 'text-yellow-400' },
  { key: 'realism_group_ironman', label: 'Realism Group Ironman',  emoji: '/icons/ranks/realism_group_ironman.webp',  combatXp: 10,  skillingXp: 10,  isIronman: true,  color: 'text-teal-400' },
  { key: 'unranked_group_ironman',label: 'Unranked Group Ironman', emoji: '/icons/ranks/unranked_group_ironman.webp',  combatXp: 80,  skillingXp: 25,  isIronman: true,  color: 'text-slate-500' },
  { key: 'twinbound',             label: 'Twinbound',              emoji: '/icons/ranks/twinbound.webp',  combatXp: 10,  skillingXp: 10,  isIronman: false, color: 'text-pink-400' },
];

export function getGameMode(key: string): GameMode {
  return GAME_MODES.find(m => m.key === key) ?? GAME_MODES[0];
}

// ─────────────────────────────────────────────────────────────────────────────

export interface MinigameData {
  id: number;
  name: string;
  rank: number;
  score: number;
}

export interface FeroxHiscoreResponse {
  name: string;
  skills: SkillData[];
  minigames?: MinigameData[];
}

export async function fetchPlayerHiscores(username: string): Promise<FeroxHiscoreResponse> {
  const base = process.env.NEXT_PUBLIC_FEROX_API_BASE ?? 'https://ferox.ps/api';
  const res = await fetch(`${base}/hiscores?player=${encodeURIComponent(username)}`, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Player not found`);
  return res.json();
}
