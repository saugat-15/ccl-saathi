"use client";

import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
Amplify.configure(outputs, { ssr: true });

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";
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
import { BookOpen, CircleDollarSign, History, HelpCircle, LogOut, Moon, Settings, Sun, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import Logo from "./Logo";

const IS_PRO = false;

function getInitials(given: string, family: string, email: string) {
  if (given && family) return `${given[0]}${family[0]}`.toUpperCase();
  if (given) return given.slice(0, 2).toUpperCase();
  const local = email.split("@")[0] ?? "";
  if (local) {
    const parts = local.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return local.slice(0, 2).toUpperCase();
  }
  return "?";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const GUEST_NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#resources", label: "Resources" },
] as const;


function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button type="button" disabled
        className="h-8 w-8 rounded-md border border-border flex items-center justify-center text-muted-foreground">
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="h-8 w-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user, authStatus } = useAuthenticator();

  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");

  const authenticated = authStatus === "authenticated";
  const loginId = user?.signInDetails?.loginId ?? "";

  useEffect(() => {
    if (!authenticated) {
      setGivenName("");
      setFamilyName("");
      setEmail("");
      return;
    }

    // Prefer loginId immediately when Authenticator has it
    if (loginId) setEmail((prev) => prev || loginId);

    let cancelled = false;
    async function loadProfile() {
      // After login, tokens/attributes can lag briefly — retry like Storage auth-ready gating
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          await fetchAuthSession();
          const attrs = await fetchUserAttributes();
          if (cancelled) return;
          setGivenName(attrs.given_name ?? "");
          setFamilyName(attrs.family_name ?? "");
          setEmail(attrs.email ?? loginId ?? "");
          return;
        } catch {
          if (attempt < 3) await sleep(250 * (attempt + 1));
        }
      }
      if (!cancelled && loginId) setEmail(loginId);
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [authenticated, loginId, user?.userId]);

  const initials = getInitials(givenName, familyName, email);
  const displayName = givenName && familyName ? `${givenName} ${familyName}` : givenName || email;
  const isLoginRoute = pathname === "/login";
  const navLinks = authenticated ? [] : GUEST_NAV;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="shrink-0">
          <Logo iconSize={28} />
        </Link>

        {/* Nav links */}
        {!isLoginRoute && (
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground" aria-label="Primary">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href}
                className="hover:text-foreground transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          <ThemeToggleButton />

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

          {/* Authenticated */}
          {authenticated && (
            <>
              {!IS_PRO && (
                <Button size="sm" variant="outline" asChild
                  className="hidden sm:inline-flex gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950 font-semibold">
                  <Link href="/pricing">
                    <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    Upgrade to Pro
                  </Link>
                </Button>
              )}

              {IS_PRO && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 px-2.5 py-0.5 rounded-full">
                  Pro
                </span>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button"
                    className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-60">
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
                    <div className="mt-2.5">
                      {IS_PRO ? (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 px-2.5 py-0.5 rounded-full">
                          Pro plan
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border border-border bg-muted px-2.5 py-0.5 rounded-full">
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
                  <DropdownMenuItem onClick={() => router.push("/pricing")}>
                    <CircleDollarSign className="h-4 w-4" />
                    Pricing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/history")} disabled>
                    <History className="h-4 w-4" />
                    My recordings
                    <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/settings")} disabled>
                    <Settings className="h-4 w-4" />
                    Settings
                    <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                  </DropdownMenuItem>

                  {!IS_PRO && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => router.push("/pricing")}
                        className="text-amber-700 focus:text-amber-700 focus:bg-amber-50 dark:text-amber-400 dark:focus:bg-amber-950/50">
                        <Zap className="h-4 w-4 fill-amber-400 text-amber-500" />
                        Upgrade to Pro
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={signOut}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10">
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
