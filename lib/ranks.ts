// OSRS Clan rank title system
// Slots 1-2: fixed (Owner, Deputy Owner)
// Slots 3-11: advanced permissions (up to 9 customisable, displayed after Deputy Owner)
// Slot 12: fixed (Administrator)
// Slots 13-27: up to 15 customisable, no advanced permissions
//
// In our DB we store rank_titles as a JSONB array of 27 strings (index 0 = slot 1).
// Slots 0 and 1 (Owner, Deputy Owner) are always fixed and cannot be edited.
// Slot 11 (index 11) maps to Administrator (fixed).

export const FIXED_RANK_TITLES: Record<number, string> = {
  1: 'Owner',
  2: 'Deputy Owner',
  12: 'Administrator',
};

export const DEFAULT_RANK_TITLES: string[] = [
  'Owner',         // 1  - fixed
  'Deputy Owner',  // 2  - fixed
  'Rank 3',        // 3  - advanced
  'Rank 4',        // 4  - advanced
  'Rank 5',        // 5  - advanced
  'Rank 6',        // 6  - advanced
  'Rank 7',        // 7  - advanced
  'Rank 8',        // 8  - advanced
  'Rank 9',        // 9  - advanced
  'Rank 10',       // 10 - advanced
  'Rank 11',       // 11 - advanced
  'Administrator', // 12 - fixed
  'Rank 13',       // 13 - no advanced perms
  'Rank 14',       // 14
  'Rank 15',       // 15
  'Rank 16',       // 16
  'Rank 17',       // 17
  'Rank 18',       // 18
  'Rank 19',       // 19
  'Rank 20',       // 20
  'Rank 21',       // 21
  'Rank 22',       // 22
  'Rank 23',       // 23
  'Rank 24',       // 24
  'Rank 25',       // 25
  'Rank 26',       // 26
  'Rank 27',       // 27
];

export interface RankOption {
  id: string;
  label: string;
  category: string;
}

export const RANK_OPTIONS: RankOption[] = [
  // Fixed clan roles
  { id: 'owner', label: 'Owner', category: 'Fixed roles' },
  { id: 'deputy-owner', label: 'Deputy Owner', category: 'Fixed roles' },
  { id: 'administrator', label: 'Administrator', category: 'Fixed roles' },
  // Army ranks 1
  { id: 'dogsbody', label: 'Dogsbody', category: 'Army ranks 1' },
  { id: 'minion', label: 'Minion', category: 'Army ranks 1' },
  { id: 'recruit', label: 'Recruit', category: 'Army ranks 1' },
  { id: 'pawn', label: 'Pawn', category: 'Army ranks 1' },
  { id: 'private', label: 'Private', category: 'Army ranks 1' },
  { id: 'corporal', label: 'Corporal', category: 'Army ranks 1' },
  { id: 'novice', label: 'Novice', category: 'Army ranks 1' },
  { id: 'sergeant', label: 'Sergeant', category: 'Army ranks 1' },
  { id: 'cadet', label: 'Cadet', category: 'Army ranks 1' },
  // Army ranks 2
  { id: 'page', label: 'Page', category: 'Army ranks 2' },
  { id: 'noble', label: 'Noble', category: 'Army ranks 2' },
  { id: 'adept', label: 'Adept', category: 'Army ranks 2' },
  { id: 'legionnaire', label: 'Legionnaire', category: 'Army ranks 2' },
  { id: 'lieutenant', label: 'Lieutenant', category: 'Army ranks 2' },
  { id: 'proselyte', label: 'Proselyte', category: 'Army ranks 2' },
  { id: 'captain', label: 'Captain', category: 'Army ranks 2' },
  { id: 'major', label: 'Major', category: 'Army ranks 2' },
  { id: 'general', label: 'General', category: 'Army ranks 2' },
  { id: 'master', label: 'Master', category: 'Army ranks 2' },
  // Army ranks 3
  { id: 'officer', label: 'Officer', category: 'Army ranks 3' },
  { id: 'commander', label: 'Commander', category: 'Army ranks 3' },
  { id: 'colonel', label: 'Colonel', category: 'Army ranks 3' },
  { id: 'brigadier', label: 'Brigadier', category: 'Army ranks 3' },
  { id: 'admiral', label: 'Admiral', category: 'Army ranks 3' },
  { id: 'marshal', label: 'Marshal', category: 'Army ranks 3' },
  // Gemstones
  { id: 'opal', label: 'Opal', category: 'Gemstones' },
  { id: 'jade', label: 'Jade', category: 'Gemstones' },
  { id: 'red-topaz', label: 'Red Topaz', category: 'Gemstones' },
  { id: 'sapphire', label: 'Sapphire', category: 'Gemstones' },
  { id: 'emerald', label: 'Emerald', category: 'Gemstones' },
  { id: 'ruby', label: 'Ruby', category: 'Gemstones' },
  { id: 'diamond', label: 'Diamond', category: 'Gemstones' },
  { id: 'dragonstone', label: 'Dragonstone', category: 'Gemstones' },
  { id: 'onyx', label: 'Onyx', category: 'Gemstones' },
  { id: 'zenyte', label: 'Zenyte', category: 'Gemstones' },
  // Non-human
  { id: 'kitten', label: 'Kitten', category: 'Non-human' },
  { id: 'bob', label: 'Bob', category: 'Non-human' },
  { id: 'wily', label: 'Wily', category: 'Non-human' },
  { id: 'hellcat', label: 'Hellcat', category: 'Non-human' },
  { id: 'skulled', label: 'Skulled', category: 'Non-human' },
  { id: 'goblin', label: 'Goblin', category: 'Non-human' },
  { id: 'beast', label: 'Beast', category: 'Non-human' },
  { id: 'imp', label: 'Imp', category: 'Non-human' },
  { id: 'gnome-child', label: 'Gnome Child', category: 'Non-human' },
  { id: 'gnome-elder', label: 'Gnome Elder', category: 'Non-human' },
  { id: 'short-green-guy', label: 'Short Green Guy', category: 'Non-human' },
  // Regions
  { id: 'misthalinian', label: 'Misthalinian', category: 'Regions' },
  { id: 'karamjan', label: 'Karamjan', category: 'Regions' },
  { id: 'asgarnian', label: 'Asgarnian', category: 'Regions' },
  { id: 'kharidian', label: 'Kharidian', category: 'Regions' },
  { id: 'morytanian', label: 'Morytanian', category: 'Regions' },
  { id: 'wild', label: 'Wild', category: 'Regions' },
  { id: 'kandarin', label: 'Kandarin', category: 'Regions' },
  { id: 'fremennik', label: 'Fremennik', category: 'Regions' },
  { id: 'tirannian', label: 'Tirannian', category: 'Regions' },
  // Religions
  { id: 'brassican', label: 'Brassican', category: 'Religions' },
  { id: 'saradominist', label: 'Saradominist', category: 'Religions' },
  { id: 'guthixian', label: 'Guthixian', category: 'Religions' },
  { id: 'zamorakian', label: 'Zamorakian', category: 'Religions' },
  { id: 'serenist', label: 'Serenist', category: 'Religions' },
  { id: 'bandosian', label: 'Bandosian', category: 'Religions' },
  { id: 'zarosian', label: 'Zarosian', category: 'Religions' },
  { id: 'armadylean', label: 'Armadylean', category: 'Religions' },
  { id: 'xerician', label: 'Xerician', category: 'Religions' },
  // Rune symbols
  { id: 'air', label: 'Air', category: 'Rune symbols' },
  { id: 'mind', label: 'Mind', category: 'Rune symbols' },
  { id: 'water', label: 'Water', category: 'Rune symbols' },
  { id: 'earth', label: 'Earth', category: 'Rune symbols' },
  { id: 'fire', label: 'Fire', category: 'Rune symbols' },
  { id: 'body', label: 'Body', category: 'Rune symbols' },
  { id: 'cosmic', label: 'Cosmic', category: 'Rune symbols' },
  { id: 'chaos', label: 'Chaos', category: 'Rune symbols' },
  { id: 'nature', label: 'Nature', category: 'Rune symbols' },
  { id: 'law', label: 'Law', category: 'Rune symbols' },
  { id: 'death', label: 'Death', category: 'Rune symbols' },
  { id: 'astral', label: 'Astral', category: 'Rune symbols' },
  { id: 'blood', label: 'Blood', category: 'Rune symbols' },
  { id: 'soul', label: 'Soul', category: 'Rune symbols' },
  { id: 'wrath', label: 'Wrath', category: 'Rune symbols' },
  // Trees
  { id: 'diseased', label: 'Diseased', category: 'Trees' },
  { id: 'pine', label: 'Pine', category: 'Trees' },
  { id: 'wintumber', label: 'Wintumber', category: 'Trees' },
  { id: 'oak', label: 'Oak', category: 'Trees' },
  { id: 'willow', label: 'Willow', category: 'Trees' },
  { id: 'maple', label: 'Maple', category: 'Trees' },
  { id: 'yew', label: 'Yew', category: 'Trees' },
  { id: 'blisterwood', label: 'Blisterwood', category: 'Trees' },
  { id: 'magic-tree', label: 'Magic', category: 'Trees' },
  // Skills
  { id: 'attacker', label: 'Attacker', category: 'Skills' },
  { id: 'enforcer', label: 'Enforcer', category: 'Skills' },
  { id: 'defender', label: 'Defender', category: 'Skills' },
  { id: 'ranger', label: 'Ranger', category: 'Skills' },
  { id: 'priest', label: 'Priest', category: 'Skills' },
  { id: 'magician', label: 'Magician', category: 'Skills' },
  { id: 'runecrafter', label: 'Runecrafter', category: 'Skills' },
  { id: 'medic', label: 'Medic', category: 'Skills' },
  { id: 'athlete', label: 'Athlete', category: 'Skills' },
  { id: 'herbologist', label: 'Herbologist', category: 'Skills' },
  { id: 'thief', label: 'Thief', category: 'Skills' },
  { id: 'crafter', label: 'Crafter', category: 'Skills' },
  { id: 'fletcher', label: 'Fletcher', category: 'Skills' },
  { id: 'miner', label: 'Miner', category: 'Skills' },
  { id: 'smith', label: 'Smith', category: 'Skills' },
  { id: 'fisher', label: 'Fisher', category: 'Skills' },
  { id: 'cook', label: 'Cook', category: 'Skills' },
  { id: 'firemaker', label: 'Firemaker', category: 'Skills' },
  { id: 'lumberjack', label: 'Lumberjack', category: 'Skills' },
  { id: 'slayer', label: 'Slayer', category: 'Skills' },
  { id: 'farmer', label: 'Farmer', category: 'Skills' },
  { id: 'constructor', label: 'Constructor', category: 'Skills' },
  { id: 'hunter', label: 'Hunter', category: 'Skills' },
  { id: 'skiller', label: 'Skiller', category: 'Skills' },
  { id: 'competitor', label: 'Competitor', category: 'Skills' },
  // Capes
  { id: 'holy', label: 'Holy', category: 'Capes' },
  { id: 'unholy', label: 'Unholy', category: 'Capes' },
  { id: 'natural', label: 'Natural', category: 'Capes' },
  { id: 'sage', label: 'Sage', category: 'Capes' },
  { id: 'destroyer', label: 'Destroyer', category: 'Capes' },
  { id: 'mediator', label: 'Mediator', category: 'Capes' },
  { id: 'legend', label: 'Legend', category: 'Capes' },
  { id: 'myth', label: 'Myth', category: 'Capes' },
  { id: 'tztok', label: 'TzTok', category: 'Capes' },
  { id: 'tzkal', label: 'TzKal', category: 'Capes' },
  { id: 'maxed', label: 'Maxed', category: 'Capes' },
  // Skilling-focused
  { id: 'anchor', label: 'Anchor', category: 'Skilling-focused' },
  { id: 'apothecary', label: 'Apothecary', category: 'Skilling-focused' },
  { id: 'merchant', label: 'Merchant', category: 'Skilling-focused' },
  { id: 'feeder', label: 'Feeder', category: 'Skilling-focused' },
  { id: 'harpoon', label: 'Harpoon', category: 'Skilling-focused' },
  { id: 'carry', label: 'Carry', category: 'Skilling-focused' },
  // Combat-focused
  { id: 'archer', label: 'Archer', category: 'Combat-focused' },
  { id: 'battlemage', label: 'Battlemage', category: 'Combat-focused' },
  { id: 'artillery', label: 'Artillery', category: 'Combat-focused' },
  { id: 'infantry', label: 'Infantry', category: 'Combat-focused' },
  { id: 'smiter', label: 'Smiter', category: 'Combat-focused' },
  { id: 'looter', label: 'Looter', category: 'Combat-focused' },
  { id: 'saviour', label: 'Saviour', category: 'Combat-focused' },
  { id: 'sniper', label: 'Sniper', category: 'Combat-focused' },
  { id: 'crusader', label: 'Crusader', category: 'Combat-focused' },
  { id: 'spellcaster', label: 'Spellcaster', category: 'Combat-focused' },
  // Miscellaneous 1
  { id: 'mentor', label: 'Mentor', category: 'Miscellaneous 1' },
  { id: 'prefect', label: 'Prefect', category: 'Miscellaneous 1' },
  { id: 'leader', label: 'Leader', category: 'Miscellaneous 1' },
  { id: 'supervisor', label: 'Supervisor', category: 'Miscellaneous 1' },
  { id: 'superior', label: 'Superior', category: 'Miscellaneous 1' },
  { id: 'executive', label: 'Executive', category: 'Miscellaneous 1' },
  { id: 'senator', label: 'Senator', category: 'Miscellaneous 1' },
  { id: 'monarch', label: 'Monarch', category: 'Miscellaneous 1' },
  { id: 'scavenger', label: 'Scavenger', category: 'Miscellaneous 1' },
  { id: 'labourer', label: 'Labourer', category: 'Miscellaneous 1' },
  { id: 'worker', label: 'Worker', category: 'Miscellaneous 1' },
  { id: 'forager', label: 'Forager', category: 'Miscellaneous 1' },
  { id: 'hoarder', label: 'Hoarder', category: 'Miscellaneous 1' },
  { id: 'prospector', label: 'Prospector', category: 'Miscellaneous 1' },
  { id: 'gatherer', label: 'Gatherer', category: 'Miscellaneous 1' },
  { id: 'collector', label: 'Collector', category: 'Miscellaneous 1' },
  { id: 'bronze', label: 'Bronze', category: 'Miscellaneous 1' },
  { id: 'iron', label: 'Iron', category: 'Miscellaneous 1' },
  { id: 'steel', label: 'Steel', category: 'Miscellaneous 1' },
  { id: 'gold', label: 'Gold', category: 'Miscellaneous 1' },
  { id: 'mithril', label: 'Mithril', category: 'Miscellaneous 1' },
  { id: 'adamant', label: 'Adamant', category: 'Miscellaneous 1' },
  { id: 'rune', label: 'Rune', category: 'Miscellaneous 1' },
  { id: 'dragon', label: 'Dragon', category: 'Miscellaneous 1' },
  { id: 'protector', label: 'Protector', category: 'Miscellaneous 1' },
  { id: 'bulwark', label: 'Bulwark', category: 'Miscellaneous 1' },
  { id: 'justiciar', label: 'Justiciar', category: 'Miscellaneous 1' },
  { id: 'sentry', label: 'Sentry', category: 'Miscellaneous 1' },
  { id: 'guardian', label: 'Guardian', category: 'Miscellaneous 1' },
  { id: 'warden', label: 'Warden', category: 'Miscellaneous 1' },
  { id: 'vanguard', label: 'Vanguard', category: 'Miscellaneous 1' },
  { id: 'templar', label: 'Templar', category: 'Miscellaneous 1' },
  { id: 'squire', label: 'Squire', category: 'Miscellaneous 1' },
  { id: 'duellist', label: 'Duellist', category: 'Miscellaneous 1' },
  { id: 'striker', label: 'Striker', category: 'Miscellaneous 1' },
  { id: 'ninja', label: 'Ninja', category: 'Miscellaneous 1' },
  { id: 'inquisitor', label: 'Inquisitor', category: 'Miscellaneous 1' },
  { id: 'expert', label: 'Expert', category: 'Miscellaneous 1' },
  { id: 'knight', label: 'Knight', category: 'Miscellaneous 1' },
  { id: 'paladin', label: 'Paladin', category: 'Miscellaneous 1' },
  { id: 'goon', label: 'Goon', category: 'Miscellaneous 1' },
  { id: 'brawler', label: 'Brawler', category: 'Miscellaneous 1' },
  { id: 'bruiser', label: 'Bruiser', category: 'Miscellaneous 1' },
  { id: 'scourge', label: 'Scourge', category: 'Miscellaneous 1' },
  { id: 'fighter', label: 'Fighter', category: 'Miscellaneous 1' },
  { id: 'warrior', label: 'Warrior', category: 'Miscellaneous 1' },
  { id: 'barbarian', label: 'Barbarian', category: 'Miscellaneous 1' },
  { id: 'berserker', label: 'Berserker', category: 'Miscellaneous 1' },
  { id: 'staff', label: 'Staff', category: 'Miscellaneous 1' },
  { id: 'crew', label: 'Crew', category: 'Miscellaneous 1' },
  { id: 'helper', label: 'Helper', category: 'Miscellaneous 1' },
  { id: 'moderator-rank', label: 'Moderator', category: 'Miscellaneous 1' },
  { id: 'sheriff', label: 'Sheriff', category: 'Miscellaneous 1' },
  // Miscellaneous 2
  { id: 'red', label: 'Red', category: 'Miscellaneous 2' },
  { id: 'orange', label: 'Orange', category: 'Miscellaneous 2' },
  { id: 'yellow', label: 'Yellow', category: 'Miscellaneous 2' },
  { id: 'green', label: 'Green', category: 'Miscellaneous 2' },
  { id: 'blue', label: 'Blue', category: 'Miscellaneous 2' },
  { id: 'purple', label: 'Purple', category: 'Miscellaneous 2' },
  { id: 'pink', label: 'Pink', category: 'Miscellaneous 2' },
  { id: 'grey', label: 'Grey', category: 'Miscellaneous 2' },
  { id: 'wizard', label: 'Wizard', category: 'Miscellaneous 2' },
  { id: 'trickster', label: 'Trickster', category: 'Miscellaneous 2' },
  { id: 'illusionist', label: 'Illusionist', category: 'Miscellaneous 2' },
  { id: 'summoner', label: 'Summoner', category: 'Miscellaneous 2' },
  { id: 'necromancer', label: 'Necromancer', category: 'Miscellaneous 2' },
  { id: 'warlock', label: 'Warlock', category: 'Miscellaneous 2' },
  { id: 'witch', label: 'Witch', category: 'Miscellaneous 2' },
  { id: 'seer', label: 'Seer', category: 'Miscellaneous 2' },
  { id: 'assassin', label: 'Assassin', category: 'Miscellaneous 2' },
  { id: 'cutpurse', label: 'Cutpurse', category: 'Miscellaneous 2' },
  { id: 'bandit', label: 'Bandit', category: 'Miscellaneous 2' },
  { id: 'scout', label: 'Scout', category: 'Miscellaneous 2' },
  { id: 'burglar', label: 'Burglar', category: 'Miscellaneous 2' },
  { id: 'rogue', label: 'Rogue', category: 'Miscellaneous 2' },
  { id: 'smuggler', label: 'Smuggler', category: 'Miscellaneous 2' },
  { id: 'brigand', label: 'Brigand', category: 'Miscellaneous 2' },
  { id: 'oracle', label: 'Oracle', category: 'Miscellaneous 2' },
  { id: 'pure', label: 'Pure', category: 'Miscellaneous 2' },
  { id: 'champion', label: 'Champion', category: 'Miscellaneous 2' },
  { id: 'epic', label: 'Epic', category: 'Miscellaneous 2' },
  { id: 'mystic', label: 'Mystic', category: 'Miscellaneous 2' },
  { id: 'hero', label: 'Hero', category: 'Miscellaneous 2' },
  { id: 'trialist', label: 'Trialist', category: 'Miscellaneous 2' },
  { id: 'defiler', label: 'Defiler', category: 'Miscellaneous 2' },
  { id: 'scholar', label: 'Scholar', category: 'Miscellaneous 2' },
  { id: 'councillor', label: 'Councillor', category: 'Miscellaneous 2' },
  { id: 'recruiter', label: 'Recruiter', category: 'Miscellaneous 2' },
  { id: 'learner', label: 'Learner', category: 'Miscellaneous 2' },
  { id: 'scribe', label: 'Scribe', category: 'Miscellaneous 2' },
  { id: 'assistant', label: 'Assistant', category: 'Miscellaneous 2' },
  { id: 'teacher', label: 'Teacher', category: 'Miscellaneous 2' },
  { id: 'coordinator', label: 'Coordinator', category: 'Miscellaneous 2' },
  { id: 'walker', label: 'Walker', category: 'Miscellaneous 2' },
  { id: 'speed-runner', label: 'Speed-Runner', category: 'Miscellaneous 2' },
  { id: 'wanderer', label: 'Wanderer', category: 'Miscellaneous 2' },
  { id: 'pilgrim', label: 'Pilgrim', category: 'Miscellaneous 2' },
  { id: 'vagrant', label: 'Vagrant', category: 'Miscellaneous 2' },
  { id: 'record-chaser', label: 'Record-chaser', category: 'Miscellaneous 2' },
  { id: 'racer', label: 'Racer', category: 'Miscellaneous 2' },
  { id: 'strider', label: 'Strider', category: 'Miscellaneous 2' },
  { id: 'doctor', label: 'Doctor', category: 'Miscellaneous 2' },
  { id: 'nurse', label: 'Nurse', category: 'Miscellaneous 2' },
  { id: 'druid', label: 'Druid', category: 'Miscellaneous 2' },
  { id: 'healer', label: 'Healer', category: 'Miscellaneous 2' },
  { id: 'zealot', label: 'Zealot', category: 'Miscellaneous 2' },
  { id: 'cleric', label: 'Cleric', category: 'Miscellaneous 2' },
  { id: 'shaman', label: 'Shaman', category: 'Miscellaneous 2' },
  { id: 'therapist', label: 'Therapist', category: 'Miscellaneous 2' },
  { id: 'gamer', label: 'Gamer', category: 'Miscellaneous 2' },
  { id: 'adventurer', label: 'Adventurer', category: 'Miscellaneous 2' },
  { id: 'explorer', label: 'Explorer', category: 'Miscellaneous 2' },
  { id: 'achiever', label: 'Achiever', category: 'Miscellaneous 2' },
  { id: 'quester', label: 'Quester', category: 'Miscellaneous 2' },
  { id: 'raider', label: 'Raider', category: 'Miscellaneous 2' },
  { id: 'completionist', label: 'Completionist', category: 'Miscellaneous 2' },
  { id: 'elite', label: 'Elite', category: 'Miscellaneous 2' },
  { id: 'firestarter', label: 'Firestarter', category: 'Miscellaneous 2' },
  { id: 'specialist', label: 'Specialist', category: 'Miscellaneous 2' },
  { id: 'burnt', label: 'Burnt', category: 'Miscellaneous 2' },
  { id: 'pyromancer', label: 'Pyromancer', category: 'Miscellaneous 2' },
  { id: 'prodigy', label: 'Prodigy', category: 'Miscellaneous 2' },
  { id: 'ignitor', label: 'Ignitor', category: 'Miscellaneous 2' },
  { id: 'artisan', label: 'Artisan', category: 'Miscellaneous 2' },
  { id: 'legacy', label: 'Legacy', category: 'Miscellaneous 2' },
];

/** Returns the icon path for a rank option id, or null if none */
export function rankIconPath(id: string): string {
  return `/icons/ranks/clan/${id}.png`;
}

/** Resolve a member's display title from the group's rank_titles array and member's rank_slot */
export function getMemberTitle(
  rankTitles: string[] | null | undefined,
  rankSlot: number | null | undefined,
  fallbackRole: 'owner' | 'admin' | 'member',
): string {
  if (rankSlot != null && rankSlot >= 1 && rankSlot <= 27) {
    const titles = rankTitles ?? DEFAULT_RANK_TITLES;
    return titles[rankSlot - 1] ?? DEFAULT_RANK_TITLES[rankSlot - 1];
  }
  // Legacy role-based fallback
  if (fallbackRole === 'owner') return 'Owner';
  if (fallbackRole === 'admin') return 'Administrator';
  return 'Member';
}
