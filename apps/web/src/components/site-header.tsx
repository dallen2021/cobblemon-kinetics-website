import Image from "next/image";
import Link from "next/link";
import type { AppMember } from "@/lib/auth";

const navigation = [
  ["Home", "/"],
  ["Wiki", "/wiki"],
  ["Studio", "/studio"],
  ["Publications", "/studio/publications"],
  ["Search", "/search"],
] as const;

export function SiteHeader({ member }: { member: AppMember | null }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Cobblemon Kinetics home">
        <Image
          className="brand-emblem"
          src="/brand/cobblemon-kinetics-emblem.png"
          alt=""
          width={1254}
          height={1254}
          sizes="48px"
          loading="eager"
          aria-hidden="true"
        />
        <span>
          <strong>Cobblemon Kinetics</strong>
          <small>Create-compatible work systems</small>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        {navigation.map(([label, href]) => (
          <Link href={href} key={href}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="account-control">
        {member ? (
          <>
            <span className="account-label">
              <strong>{member.displayName}</strong>
              <small>
                {member.role}
                {member.fixture ? " · fixture" : ""}
              </small>
            </span>
            <form action="/auth/sign-out" method="post">
              <button className="button button-quiet" type="submit">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link className="button button-quiet" href="/auth/sign-in">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
