import Link from "next/link";
import type { ReactNode } from "react";
import { MaterialPanel } from "./ui";

export function WikiCard({
  href,
  title,
  eyebrow,
  children,
  footer,
}: {
  href: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <MaterialPanel as="article" className="wiki-card" eyebrow={eyebrow}>
      <h2>
        <Link href={href}>{title}</Link>
      </h2>
      <div className="wiki-card-body">{children}</div>
      {footer ? <footer>{footer}</footer> : null}
    </MaterialPanel>
  );
}
