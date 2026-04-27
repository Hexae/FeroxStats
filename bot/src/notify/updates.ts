import { type Group, type BotState } from '../db.js';
import { Colors, sendWebhook, type Embed } from '../discord.js';

const SITE_URL = process.env.SITE_URL ?? 'https://feroxstats.com';

type ApiUpdate = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  publishedAtISO: string;
  image: string;
  url: string;
};

export async function handleUpdates(group: Group): Promise<BotState> {
  const state = { ...group.bot_state };
  const webhookUrl = group.discord_webhook_url!;

  try {
    const res = await fetch(`${SITE_URL}/api/updates?limit=1`);
    if (!res.ok) {
      return state;
    }

    const body = (await res.json()) as { updates?: ApiUpdate[] };
    const latest = body.updates?.[0];

    if (!latest) {
      return state;
    }

    if (state.last_update_slug === latest.slug) {
      return state;
    }

    const updateUrl = `${SITE_URL}/updates/${latest.slug}`;
    const embed: Embed = {
      title: `📰  New Ferox update: ${latest.title}`,
      description: latest.summary,
      color: Colors.green,
      fields: [
        { name: 'Category', value: latest.category, inline: true },
        { name: 'Published', value: latest.date, inline: true },
      ],
      url: updateUrl,
      footer: { text: 'FeroxStats · Updates' },
      timestamp: latest.publishedAtISO,
    };

    await sendWebhook(webhookUrl, [embed]);
    state.last_update_slug = latest.slug;

    return state;
  } catch (error) {
    console.error('[updates] notify error:', error);
    return state;
  }
}
