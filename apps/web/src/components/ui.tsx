import Image from "next/image";
import type { ReactNode } from "react";

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function MaterialPanel({
  title,
  eyebrow,
  children,
  className,
  as = "section",
  headingLevel = 2,
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
  headingLevel?: 1 | 2;
}) {
  const Element = as;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <Element className={classNames("material-panel", className)}>
      <span className="panel-bolt panel-bolt-a" aria-hidden="true" />
      <span className="panel-bolt panel-bolt-b" aria-hidden="true" />
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      {title ? <Heading>{title}</Heading> : null}
      {children}
    </Element>
  );
}

export function TypeChip({ type }: { type: string }) {
  return <span className={`type-chip type-${type.toLocaleLowerCase()}`}>{type}</span>;
}

export function RegistryId({ children }: { children: string }) {
  return <code className="registry-id">{children}</code>;
}

export function StatusLamp({
  tone,
  label,
}: {
  tone: "green" | "amber" | "red" | "teal";
  label: string;
}) {
  return (
    <span className="status-lamp">
      <span className={`status-dot status-${tone}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function ItemSlot({
  label,
  registryId,
  active = false,
}: {
  label: string;
  registryId: string;
  active?: boolean;
}) {
  return (
    <span className={classNames("item-slot", active && "item-slot-active")}>
      <span className="item-slot-copy">
        <strong>{label}</strong>
        <RegistryId>{registryId}</RegistryId>
      </span>
    </span>
  );
}

export function EfficiencyGauge({ value }: { value: number }) {
  const bounded = Math.min(2, Math.max(0, value));
  return (
    <div className="efficiency-gauge">
      <div className="gauge-track" aria-hidden="true">
        <span style={{ width: `${(bounded / 2) * 100}%` }} />
      </div>
      <span className="gauge-value">{value.toFixed(2)}×</span>
      <span className="sr-only">Efficiency multiplier {value.toFixed(2)}</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <Image
        className="empty-state-art"
        src="/art/generated/empty-workbench.webp"
        alt=""
        width={180}
        height={145}
        aria-hidden="true"
      />
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lede">{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
