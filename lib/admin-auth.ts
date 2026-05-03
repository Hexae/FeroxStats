import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from './database.types';

type AnonSupabase = SupabaseClient<Database>;

interface AdminAuthResult {
  supabase: AnonSupabase | null;
  user: User | null;
  error: string | null;
}

/**
 * Returns an authenticated Supabase client if the current session belongs to
 * an admin user, otherwise returns `{ supabase: null, error }`.
 *
 * Used exclusively by `/api/admin/*` routes.
 */
export async function getAdminClient(): Promise<AdminAuthResult> {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  ) as AnonSupabase;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase: null, user: null, error: 'Not authenticated' };
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return { supabase: null, user: null, error: 'Not authorized' };
  }

  return { supabase, user, error: null };
}
