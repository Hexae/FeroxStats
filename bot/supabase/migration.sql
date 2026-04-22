-- Add rank titles, rank icons, and Discord bot support to groups
-- Add rank slot and rank icon support to group members
-- Run this migration against your Supabase project:
--   supabase db push  OR  paste into the Supabase SQL Editor

-- 27-element JSONB array of custom rank title strings (index 0 = slot 1)
-- 27-element JSONB array of icon ids (e.g. 'recruit', 'dragon') per rank slot
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS bot_state JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rank_titles JSONB,
  ADD COLUMN IF NOT EXISTS rank_icons JSONB,
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Each member can have a rank slot (1-27). NULL means legacy role-based display.
-- rank_icon_id references the icon filename (e.g. 'recruit', 'dragon', etc.)
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS rank_slot INTEGER CHECK (rank_slot >= 1 AND rank_slot <= 27),
  ADD COLUMN IF NOT EXISTS rank_icon_id TEXT;

-- Optional: only group owners/admins should be able to set the webhook URL.
-- The application enforces this; no extra RLS is strictly required because
-- the bot uses the service-role key which bypasses RLS.
--
-- If you want to allow the Next.js server (anon/auth keys) to read bot_state
-- add a SELECT policy, e.g.:
--
-- CREATE POLICY IF NOT EXISTS "group members can read bot_state"
--   ON groups FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM group_members
--       WHERE group_members.group_id = groups.id
--         AND group_members.username = (current_setting('request.jwt.claims', true)::json ->> 'sub')
--     )
--   );
