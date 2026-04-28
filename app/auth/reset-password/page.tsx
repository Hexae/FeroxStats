'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isCancelled) return;

      if (user) {
        setCanReset(true);
        setError(null);
      } else {
        setCanReset(false);
        setError('This reset link is invalid or expired. Request a new reset email from your account settings.');
      }

      setCheckingSession(false);
    }

    void checkSession();

    return () => {
      isCancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setSuccess('Password updated. You can continue to your account.');
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 animate-fade-up">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-slate-400 text-sm">Set a new password for your FeroxStats account.</p>
        </div>

        <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-6 shadow-2xl space-y-4">
          {checkingSession && (
            <p className="text-sm text-slate-400">Validating reset link...</p>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-green-400 text-sm">
              {success}
            </div>
          )}

          {!checkingSession && canReset && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/30 text-sm"
              >
                {loading ? 'Updating password…' : 'Update Password'}
              </button>
            </form>
          )}

          <div className="flex items-center justify-between text-sm pt-1">
            <Link href="/auth/login" className="text-slate-400 hover:text-slate-300 transition-colors">
              Back to login
            </Link>
            <button
              type="button"
              onClick={() => {
                router.push('/account');
                router.refresh();
              }}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Go to account
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
