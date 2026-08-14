"use client";

import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import type { Ref } from "react";

export function PanelToggle({
  expanded,
  label,
  controls,
  onToggle,
  className,
  buttonRef,
  appearance = "label",
}: {
  expanded: boolean;
  label: string;
  controls: string;
  onToggle: () => void;
  className?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  appearance?: "label" | "caret";
}) {
  const action = expanded ? "Hide" : "Show";
  const accessibleLabel = `${action} ${label}`;
  const CaretIcon = expanded ? CaretLeftIcon : CaretRightIcon;
  return (
    <button
      ref={buttonRef}
      className={className}
      type="button"
      aria-controls={controls}
      aria-expanded={expanded}
      aria-label={accessibleLabel}
      data-direction={appearance === "caret" ? (expanded ? "collapse" : "expand") : undefined}
      onClick={onToggle}
      title={appearance === "caret" ? accessibleLabel : undefined}
    >
      {appearance === "caret" ? (
        <CaretIcon aria-hidden className="panel-toggle-arrow" size={18} weight="bold" />
      ) : (
        <>
          <span>{action}</span>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
