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
  return n.toLocaleString('en-US');
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

// ── Country utilities ─────────────────────────────────────────────────────────

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
}

/** Convert an ISO 3166-1 alpha-2 code to an emoji flag string. */
export function countryCodeToFlag(code: string): string {
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

export const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo (DRC)' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KP', name: 'North Korea' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'Sao Tome and Principe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

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
