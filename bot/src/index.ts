import 'dotenv/config';
import { getActiveGroups, saveBotState } from './db.js';
import { handleMembers } from './notify/members.js';
import { handleCompetitions } from './notify/competitions.js';
import { handleAchievements } from './notify/achievements.js';
import { handleDeaths } from './notify/deaths.js';
import { handleUpdates } from './notify/updates.js';

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '60000', 10);

async function poll(): Promise<void> {
  const groups = await getActiveGroups();

  for (const group of groups) {
    try {
      // Run all handlers. Each returns an updated copy of bot_state.
      // We merge the results sequentially so partial updates aren't lost.
      let state = group.bot_state;

      state = await handleMembers({ ...group, bot_state: state });
      state = await handleCompetitions({ ...group, bot_state: state });
      state = await handleAchievements({ ...group, bot_state: state });
      state = await handleDeaths({ ...group, bot_state: state });
      state = await handleUpdates({ ...group, bot_state: state });

      await saveBotState(group.id, state);
    } catch (err) {
      console.error(`[poll] Error processing group "${group.slug}":`, err);
    }
  }
}

async function main(): Promise<void> {
  console.log(`FeroxStats Discord Bot starting — polling every ${POLL_INTERVAL_MS / 1000}s`);
  await poll();
  setInterval(() => {
    poll().catch((err) => console.error('[poll] Uncaught error:', err));
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error('[main] Fatal error:', err);
  process.exit(1);
});
