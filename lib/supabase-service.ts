import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Shared service-role client for API routes that need to bypass RLS.
let _client: ReturnType<typeof createClient<Database>> | null = null;

export function serviceClient() {
  if (_client) return _client;
  _client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  return _client;
}
