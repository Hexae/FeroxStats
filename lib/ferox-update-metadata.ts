export type FeroxUpdateMetadata = {
  rawDate: string;
  title: string;
  summary: string;
};

export const UPDATE_METADATA_BY_ID: Record<number, FeroxUpdateMetadata> = {
  1: { rawDate: "8/30/2025 11:40 AM", title: "Game Update #1", summary: "Thank you all for being part of our launch! We're very happy with how it went. Here's a list of recent changes that have been made." },
  2: { rawDate: "02/09/2025 5:50 AM", title: "Game Update #2", summary: "(Potential) Fix for npcs breaking (notebly Wintertodt)" },
  3: { rawDate: "01/09/2025 3:46 AM", title: "Game Update #3", summary: "Fixed pathing issue to the hoppers in MLM." },
  4: { rawDate: "05/09/2025 9:17 AM", title: "Game Update #4", summary: "You can now receive a Sanctum artifact worth 1,000 Sanctum Points from skilling. This should allow players to get access to more early-game relics. You can not receive this artifact in the AFK-Zone. Additionally, you ..." },
  5: { rawDate: "12/09/2025 4:44 AM", title: "Game Update #5", summary: "Wildy keys now reward the player with more raw cash." },
  6: { rawDate: "14/09/2025 7:59 AM", title: "Game Update #6", summary: "A smaller update following the bigger one we had on friday." },
  7: { rawDate: "19/09/2025 6:14 AM", title: "Game Update #7", summary: "Muttadile's can no longer be safe-spotted." },
  8: { rawDate: "26/09/2025 5:41 AM", title: "Game Update - Yama, the Master of Pacts", summary: "Yama will be returning to his throne at 6PM GMT. This'll give all players a fair chance at competing - More information will be posted in #announcements soon!" },
  9: { rawDate: "28/09/2025 6:11 AM", title: "Game Update #9", summary: "Fire Streaks: You'll no longer be hit by them if you're continuously moving." },
  10: { rawDate: "3/10/2025 6:17 AM", title: "Game Update - Doom of Mokhaiotl", summary: "You'll be able to begin your Delves at 6PM GMT. This'll give all players a fair chance at competing - More information will be posted in #announcements soon!" },
  11: { rawDate: "4/10/2025", title: "Game Update #11", summary: "Doom of Mokhaiotl - Fixes / Adjustments" },
  12: { rawDate: "10/10/2025", title: "Game Update - Pet Perk Adjustments", summary: "+20% chance to create two potions instead of one" },
  13: { rawDate: "17/10/2025", title: "Game Update - Blackjack / Gambling Changes", summary: "Gambling + Server-Hosted Blackjack" },
  14: { rawDate: "24/10/2025 9:00 AM", title: "Game Update - Halloween Event & Wilderness Rebalancing", summary: "## 🎃 **Halloween Event** *(October 24 – November 7)*" },
  15: { rawDate: "31/10/2025 10:37 AM", title: "Game Update - Hueycoatl & Dice", summary: "## 🐦  **The Hueycoatl Has Arrived!**" },
  16: { rawDate: "14/11/2025 5:39 AM", title: "Game Update - Bingo Event, Skill Mastery Capes", summary: "You can obtain a Bingo Card from the Event Shop located at Home, near the Vote store." },
  17: { rawDate: "21/11/2025 4:51 AM", title: "Game Update - GIM Adjustments, Relic & Tier-5 Item Upgrade Perk expansions & more", summary: "Leaders are now able to remove members with a 7-day grace period. Members in this grace period (whether being removed or voluntarily leaving) are restricted from interacting with the Group Storage Unit." },
  18: { rawDate: "07/11/2025 9:21 AM", title: "Game Update - Supreme donator island & more!", summary: "Gain a chance to automatically receive clue reward caskets in place of clue scrolls from monsters. (20%)" },
  19: { rawDate: "28/11/2025 8:07 AM", title: "Game Update - Mastering Mixology & More", summary: "There's no need for secondary ingredients here, so you'll only need to stock up on herbs." },
  20: { rawDate: "05/12/2025 7:54 AM", title: "Game Update - Christmas event & More", summary: "🎄 **Christmas Event Has Begun!** ❄️" },
  21: { rawDate: "12/12/2025 5:15 AM", title: "Game Update #21", summary: "Vorkath's zombified spawn will no longer do damage if Vorkath is dead." },
  22: { rawDate: "19/12/2025 5:12 AM", title: "Game Update - Sanctum Bounties & More", summary: "**Sanctum Bounties** unlock as you progress through Sanctum tiers:" },
  23: { rawDate: "09/01/2026 5:57 AM", title: "Game Update - Wilderness, Sanctum Bounties Balancing & More", summary: "Hope you all had a great holiday!🎉The christmas event is now over. Any wrapping paper you may have left will automatically be converted to presents. Here's what else has been worked on.." },
  24: { rawDate: "17/01/2026 6:51 AM", title: "Game Update - Collection Logs, Trading Post & More", summary: "We know many of you enjoy working toward long-term goals, and one of the most popular goals is upgrading your donator rank. To make that journey more rewarding, we’ve added a large number of bonds to our Collection Lo..." },
  25: { rawDate: "23/01/2026 9:12 AM", title: "Game Update - Pets, Town Board & More", summary: "## Boss Pet \"Pity\" Drop Rate Bonus" },
  26: { rawDate: "06/02/2026 8:12 AM", title: "Game Update - Sanctum Vault, Vale totems & More", summary: "# <:doomed:580372187735654400> Sanctum Vault" },
  27: { rawDate: "13/02/2026 5:03 AM", title: "Game Update - Sanctum Vault / Twinbound Game mode adjustments & More", summary: "We’ve been listening to your feedback and understand that many of you felt the drop rate bonuses were unlocked too late in the game, making them less useful since you had already spent significant time grinding for ma..." },
  28: { rawDate: "20/02/2026 6:26 AM", title: "Game Update - Sanctum Vault, Scurrius & More", summary: "Now activates melee protection prayer when reaching 60% health, it is deactivated when the champion becomes enraged." },
  29: { rawDate: "27/02/2026 7:23 AM", title: "Game Update - Achievements, Sanctum Vault & More", summary: "## Achievements - New Additions" },
  30: { rawDate: "06/03/2026 11:30 AM", title: "Game Update - Azzanadra, Youtube & More", summary: "The powerful Zarosian Mahjarrat **Azzanadra** has arrived at **Ferox**! His crypt entrance spawns every **2 hours**, and the encounter **scales with the number of players** who participate." },
  31: { rawDate: "13/03/2026 11:51 AM", title: "Changes to Azzanadra, Twinbound & More", summary: "The fight now starts 2 minutes and 30 seconds after the crypt spawns (previously 5 mins)." },
  32: { rawDate: "03/04/2026 5:46 AM", title: "Shellbane Gryphon, Deadman's Chest buffs& More", summary: "As mentioned in our previous update, we'll be gradually introducing content from the Sailing skill. The first addition is **The Great Conch**, a brand-new island now accessible via the teleporter." },
  33: { rawDate: "30/03/2026 3:52 AM", title: "Revision Upgrade, Brutus, Easter Event & More", summary: "The game has been updated to the latest revision, allowing us to work on developing newer content such as **Brutus**, introduced in this update." },
  34: { rawDate: "10/04/2026 8:16 AM", title: "Pk Bots, Mobile Client, New Slayer Monsters & More", summary: "Mobile client is back up and running - now available for download!" },
  35: { rawDate: "17/04/2026 8:13 AM", title: "Duo Slayer, Minigame Bots & More", summary: "You can now team up with a friend to speed up Slayer task progression. Simply right-click your Enchanted gem or Slayer helmet and select the **\"Partner\"** option to get started." },
  36: { rawDate: "24/04/2026 4:49 AM", title: "Player Hosted Tournaments & More", summary: "The Easter bunny has hopped away from Ferox.." },
};
