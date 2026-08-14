"use client";

import type { Ref } from "react";

export function PanelToggle({
  expanded,
  label,
  controls,
  onToggle,
  className,
  buttonRef,
}: {
  expanded: boolean;
  label: string;
  controls: string;
  onToggle: () => void;
  className?: string;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const action = expanded ? "Hide" : "Show";
  return (
    <button
      ref={buttonRef}
      className={className}
      type="button"
      aria-controls={controls}
      aria-expanded={expanded}
      aria-label={`${action} ${label}`}
      onClick={onToggle}
    >
      <span>{action}</span>
      <span>{label}</span>
    </button>
  );
}
