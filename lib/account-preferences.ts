export type SearchModePreference = 'smart' | 'full';

export type AccountPreferencePayload = {
  timezone: string;
  locale: string;
  default_search_mode: SearchModePreference;
  prefers_compact_numbers: boolean;
  notify_milestones: boolean;
  notify_competitions: boolean;
  notify_updates: boolean;
  notify_email: boolean;
  notify_discord: boolean;
  mfa_enabled: boolean;
};

export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferencePayload = {
  timezone: 'UTC',
  locale: 'en-US',
  default_search_mode: 'smart',
  prefers_compact_numbers: true,
  notify_milestones: true,
  notify_competitions: true,
  notify_updates: true,
  notify_email: true,
  notify_discord: false,
  mfa_enabled: false,
};
