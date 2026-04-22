export default function AuthErrorPage() {
  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-2xl font-bold text-red-400 mb-2">Authentication Error</p>
        <p className="text-slate-400">Could not sign you in. Please try again.</p>
        <a href="/auth/login" className="mt-4 inline-block text-red-400 hover:underline">Back to login</a>
      </div>
    </main>
  );
}
