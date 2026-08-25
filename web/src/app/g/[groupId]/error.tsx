"use client";

import { useEffect } from "react";

/**
 * Scoped to the group segment (sibling of layout.tsx) so an error thrown by
 * any tab's page content is caught HERE -- keeping the parent layout (nav
 * shell, tabs, header) mounted and clickable, rather than the error
 * bubbling all the way up with no boundary and wiping out the whole tree,
 * tabs included, which is what was happening before this file existed.
 */
export default function GroupSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mt-4 rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-6">
      <h2 className="text-lg font-bold text-[#dc3545]">Something went wrong loading this page</h2>
      <p className="mt-2 text-sm text-[#333] font-mono break-words">{error.message}</p>
      {error.digest && <p className="mt-1 text-xs text-[#999]">Digest: {error.digest}</p>}
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45]"
      >
        Try again
      </button>
    </div>
  );
}
