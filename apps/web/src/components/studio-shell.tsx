"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { AppMember } from "@/lib/auth";
import { PanelToggle } from "./panel-toggle";
import {
  STUDIO_LEFT_PANEL_COOKIE,
  STUDIO_RIGHT_PANEL_COOKIE,
  type StudioTheme,
} from "./studio-preferences";
import { ThemeToggle } from "./theme-toggle";
import { StatusLamp } from "./ui";

const sections = [
  ["Overview", "/studio"],
  ["Squirtle", "/studio/pokemon/squirtle"],
  ["Compatibility", "/studio/compatibility"],
  ["Workboard", "/studio/workboard"],
  ["Imports", "/studio/imports"],
  ["Publications", "/studio/publications"],
  ["Assets", "/studio/assets"],
  ["History", "/studio/history"],
  ["Access", "/studio/settings/access"],
] as const;

const MOBILE_MEDIA_QUERY = "(max-width: 1100px)";

function subscribeToMobileViewport(onStoreChange: () => void): () => void {
  const media = window.matchMedia(MOBILE_MEDIA_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function getServerMobileSnapshot(): boolean {
  return false;
}

function persistPanel(cookie: string, collapsed: boolean): void {
  const value = collapsed ? "collapsed" : "expanded";
  document.cookie = `${cookie}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function StudioShell({
  member,
  children,
  initialTheme,
  initialLeftCollapsed,
  initialRightCollapsed,
}: {
  member: AppMember;
  children: ReactNode;
  initialTheme: StudioTheme;
  initialLeftCollapsed: boolean;
  initialRightCollapsed: boolean;
}) {
  const pathname = usePathname();
  const isMobile = useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileSnapshot,
    getServerMobileSnapshot,
  );
  const [leftCollapsed, setLeftCollapsed] = useState(initialLeftCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState(initialRightCollapsed);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const leftToggleRef = useRef<HTMLButtonElement>(null);
  const rightToggleRef = useRef<HTMLButtonElement>(null);
  const hasInspector = pathname.startsWith("/studio/pokemon/");
  const leftExpanded = isMobile ? leftDrawerOpen : !leftCollapsed;
  const rightExpanded = hasInspector && (isMobile ? rightDrawerOpen : !rightCollapsed);

  useEffect(() => {
    function closeDrawers(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      if (leftDrawerOpen) {
        setLeftDrawerOpen(false);
        leftToggleRef.current?.focus();
      }
      if (rightDrawerOpen) {
        setRightDrawerOpen(false);
        rightToggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", closeDrawers);
    return () => document.removeEventListener("keydown", closeDrawers);
  }, [leftDrawerOpen, rightDrawerOpen]);

  function toggleLeftPanel(): void {
    if (isMobile) {
      setRightDrawerOpen(false);
      setLeftDrawerOpen((open) => !open);
      return;
    }
    setLeftCollapsed((collapsed) => {
      const next = !collapsed;
      persistPanel(STUDIO_LEFT_PANEL_COOKIE, next);
      return next;
    });
  }

  function toggleRightPanel(): void {
    if (isMobile) {
      setLeftDrawerOpen(false);
      setRightDrawerOpen((open) => !open);
      return;
    }
    setRightCollapsed((collapsed) => {
      const next = !collapsed;
      persistPanel(STUDIO_RIGHT_PANEL_COOKIE, next);
      return next;
    });
  }

  function closeMobilePanels(): void {
    setLeftDrawerOpen(false);
    setRightDrawerOpen(false);
  }

  return (
    <div
      className="studio-shell"
      data-left-collapsed={!leftExpanded}
      data-right-collapsed={!rightExpanded}
      data-mobile-left-open={leftDrawerOpen}
      data-mobile-right-open={rightDrawerOpen}
    >
      <aside className="studio-sidebar" id="studio-navigation">
        <div className="studio-brand">
          <Image
            alt=""
            aria-hidden="true"
            className="studio-brand-mark"
            height={72}
            preload
            src="/brand/cobblemon-kinetics-emblem.png"
            width={72}
          />
          <div className="studio-brand-copy">
            <strong>Cobblemon Kinetics</strong>
          </div>
        </div>
        <PanelToggle
          className="studio-panel-toggle studio-navigation-toggle"
          controls="studio-navigation"
          expanded={leftExpanded}
          label="navigation"
          onToggle={toggleLeftPanel}
        />
        <div className="studio-sidebar-heading">
          <p className="eyebrow">Development studio</p>
          <h2>Gen 1 workshop</h2>
        </div>
        <nav aria-label="Studio navigation">
          {sections.map(([label, href]) => (
            <Link
              aria-current={pathname === href ? "page" : undefined}
              className={pathname === href ? "studio-nav-link-active" : undefined}
              href={href}
              key={href}
              onClick={() => setLeftDrawerOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="studio-identity">
          <StatusLamp
            tone={member.fixture ? "amber" : "green"}
            label={member.fixture ? "Safe fixture" : "Authenticated"}
          />
          <p>
            <strong>{member.displayName}</strong>
            <br />
            <span>{member.role}</span>
          </p>
          <form action="/auth/sign-out" method="post">
            <button className="studio-sign-out" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="studio-main">
        <header className="studio-toolbar">
          <PanelToggle
            buttonRef={leftToggleRef}
            className="studio-panel-toggle studio-mobile-navigation-launcher"
            controls="studio-navigation"
            expanded={leftExpanded}
            label="navigation"
            onToggle={toggleLeftPanel}
          />
          <div className="studio-toolbar-title">
            <strong>Workshop Ledger</strong>
            <span>Gen 1 workshop</span>
          </div>
          <div className="studio-toolbar-controls">
            <span className="studio-toolbar-account">
              <strong>{member.displayName}</strong>
              <span>{member.role}</span>
            </span>
            <ThemeToggle initialTheme={initialTheme} />
            {hasInspector ? (
              <PanelToggle
                buttonRef={rightToggleRef}
                className="studio-panel-toggle studio-inspector-toggle"
                controls="studio-workspace"
                expanded={rightExpanded}
                label="inspector"
                onToggle={toggleRightPanel}
              />
            ) : null}
          </div>
        </header>
        <div className="studio-workspace" id="studio-workspace">
          {children}
        </div>
      </div>
      {isMobile && (leftDrawerOpen || rightDrawerOpen) ? (
        <button
          className="studio-panel-scrim"
          type="button"
          aria-label="Close open panel"
          onClick={closeMobilePanels}
        />
      ) : null}
      {isMobile && rightDrawerOpen ? (
        <PanelToggle
          className="studio-panel-toggle studio-mobile-inspector-close"
          controls="studio-workspace"
          expanded
          label="inspector"
          onToggle={toggleRightPanel}
        />
      ) : null}
    </div>
  );
}
