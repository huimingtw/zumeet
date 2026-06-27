
import { useState } from "react";

export function CopyableId({
  id,
  truncate = 8,
}: {
  id: string;
  truncate?: number;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={id}
      className="relative font-mono text-[12px] text-ink-500 hover:text-ink-900 transition-colors cursor-pointer"
    >
      {copied ? (
        <span className="text-success-600">Copied!</span>
      ) : (
        id.slice(0, truncate) + "…"
      )}
    </button>
  );
}
