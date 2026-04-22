// Discord webhook helper — no discord.js dependency needed for outgoing webhooks.

const SITE_URL = process.env.SITE_URL ?? 'https://feroxstats.com';

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface Embed {
  title?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
  url?: string;
  thumbnail?: { url: string };
}

export const Colors = {
  green:  0x22c55e,
  blue:   0x3b82f6,
  yellow: 0xf59e0b,
  purple: 0x8b5cf6,
  red:    0xef4444,
  gold:   0xfbbf24,
  grey:   0x64748b,
} as const;

/** Post one or more embeds to a Discord webhook URL. */
export async function sendWebhook(
  webhookUrl: string,
  embeds: Embed[],
  username = 'FeroxStats',
): Promise<void> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, embeds }),
    });

    if (!res.ok) {
      // 429 = rate limited
      if (res.status === 429) {
        const data = await res.json().catch(() => ({})) as { retry_after?: number };
        const retryAfter = (data.retry_after ?? 1) * 1000;
        console.warn(`[discord] Rate limited — retrying after ${retryAfter}ms`);
        await sleep(retryAfter);
        await sendWebhook(webhookUrl, embeds, username);
        return;
      }
      console.error(`[discord] Webhook POST failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error('[discord] sendWebhook error:', err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Embed builders ────────────────────────────────────────────────────────────

export function playerUrl(username: string): string {
  return `${SITE_URL}/player/${encodeURIComponent(username)}`;
}

export function groupUrl(slug: string): string {
  return `${SITE_URL}/groups/${encodeURIComponent(slug)}`;
}

export function competitionUrl(id: string): string {
  return `${SITE_URL}/competitions/${encodeURIComponent(id)}`;
}

/** Bold display name linked to the player page. */
export function playerLink(display: string, username: string): string {
  return `**[${display}](${playerUrl(username)})**`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDuration(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.length ? parts.join(' ') : '<1m';
}
