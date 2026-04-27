'use client';

import { useState } from 'react';

type UpdateShareButtonProps = {
  title: string;
};

export default function UpdateShareButton({ title }: UpdateShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={`Copy link to ${title}`}
      onClick={copyLink}
      className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
    >
      {copied ? 'Link Copied' : 'Copy Link'}
    </button>
  );
}
