"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { fetchUserAttributes } from "aws-amplify/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { BookOpen, History, HelpCircle, LogOut, Settings, Zap } from "lucide-react";

// Hardcoded to false until billing backend is ready
const IS_PRO = false;

function getInitials(given: string, family: string, email: string) {
  if (given && family) return `${given[0]}${family[0]}`.toUpperCase();
  if (given) return given.slice(0, 2).toUpperCase();
  const parts = email.split("@")[0].split(/[._-]/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

const GUEST_NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#resources", label: "Resources" },
] as const;

const AUTH_NAV = [
  { href: "/", label: "Practice" },
  { href: "/pricing", label: "Pricing" },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user, authStatus } = useAuthenticator();
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");

  const email = user?.signInDetails?.loginId ?? "";
  const authenticated = authStatus === "authenticated";

  useEffect(() => {
    if (!authenticated) return;
    fetchUserAttributes()
      .then((attrs) => {
        setGivenName(attrs.given_name ?? "");
        setFamilyName(attrs.family_name ?? "");
      })
      .catch(() => { });
  }, [authenticated]);

  const initials = getInitials(givenName, familyName, email);
  const displayName =
    givenName && familyName ? `${givenName} ${familyName}` : givenName || email;

  const isLoginRoute = pathname === "/login";
  const navLinks = authenticated ? AUTH_NAV : GUEST_NAV;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {/* Icon mark */}
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <rect width="32" height="32" rx="8" fill="#3a7d4e" />
            <rect x="11" y="14" width="16" height="10" rx="2.5" fill="white" fillOpacity="0.5" />
            <path d="M22 24 L25.5 28 L18.5 24Z" fill="white" fillOpacity="0.5" />
            <rect x="5" y="7" width="16" height="10" rx="2.5" fill="white" />
            <path d="M9 17 L5.5 21 L13 17Z" fill="white" />
          </svg>
          <div>
            <div className="font-serif font-semibold text-[17px] leading-none tracking-tight text-foreground">
              CCLSaathi
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-0.5">
              Nepali · CCL
            </div>
          </div>
        </Link>

        {/* Nav links */}
        {!isLoginRoute && (
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground" aria-label="Primary">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          {/* Guest: Log in + Sign up */}
          {!isLoginRoute && !authenticated && (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" className="font-semibold" asChild>
                <Link href="/login?tab=signup">Sign up free</Link>
              </Button>
            </>
          )}

          {/* Authenticated: Upgrade pill + avatar dropdown */}
          {authenticated && (
            <>
              {/* Upgrade to Pro — only shown when not pro */}
              {!IS_PRO && (
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden sm:inline-flex gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 font-semibold"
                  asChild
                >
                  <Link href="/pricing">
                    <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    Upgrade to Pro
                  </Link>
                </Button>
              )}

              {/* Pro badge when subscribed */}
              {IS_PRO && (
                <span style={{
                  fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                  fontWeight: 700, color: "var(--forest-700)",
                  background: "var(--forest-50)", border: "1px solid var(--forest-200)",
                  padding: "3px 8px", borderRadius: 20,
                }}>
                  Pro
                </span>
              )}

              {/* Avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-60">
                  {/* User info */}
                  <DropdownMenuLabel className="font-normal pb-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{email}</p>
                      </div>
                    </div>
                    {/* Plan badge */}
                    <div className="mt-2.5">
                      {IS_PRO ? (
                        <span style={{
                          fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                          fontWeight: 700, color: "var(--forest-700)",
                          background: "var(--forest-50)", border: "1px solid var(--forest-200)",
                          padding: "3px 9px", borderRadius: 20,
                        }}>
                          Pro plan
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                          fontWeight: 700, color: "var(--fg-muted)",
                          background: "var(--gg-100)", border: "1px solid var(--gg-200)",
                          padding: "3px 9px", borderRadius: 20,
                        }}>
                          Free plan
                        </span>
                      )}
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => router.push("/")}>
                    <BookOpen className="h-4 w-4" />
                    Practice
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/history")} disabled>
                    <History className="h-4 w-4" />
                    My Recordings
                    <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/settings")} disabled>
                    <Settings className="h-4 w-4" />
                    Settings
                    <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/help")} disabled>
                    <HelpCircle className="h-4 w-4" />
                    Help
                  </DropdownMenuItem>

                  {/* Upgrade CTA inside dropdown for non-pro */}
                  {!IS_PRO && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => router.push("/pricing")}
                        className="text-amber-700 focus:text-amber-700 focus:bg-amber-50"
                      >
                        <Zap className="h-4 w-4 fill-amber-400 text-amber-500" />
                        Upgrade to Pro
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={signOut}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
      <Separator />
    </header>
  );
}
