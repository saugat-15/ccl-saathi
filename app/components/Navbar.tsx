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
import { BookOpen, History, HelpCircle, LogOut, Settings } from "lucide-react";

function getInitials(given: string, family: string, email: string) {
  if (given && family) return `${given[0]}${family[0]}`.toUpperCase();
  if (given) return given.slice(0, 2).toUpperCase();
  const parts = email.split("@")[0].split(/[._-]/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#resources", label: "Resources" },
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
      .catch(() => {});
  }, [authenticated]);

  const initials = getInitials(givenName, familyName, email);
  const displayName =
    givenName && familyName ? `${givenName} ${familyName}` : givenName || email;

  const isLoginRoute = pathname === "/login";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center font-bold text-lg tracking-tight shrink-0">
          CCL<span className="text-primary">Saathi</span>
        </Link>

        {!isLoginRoute ? (
          <nav
            className="hidden md:flex items-center gap-6 text-sm text-muted-foreground"
            aria-label="Primary"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!isLoginRoute && !authenticated ? (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" className="font-semibold" asChild>
                <Link href="/login?tab=signup">Sign up free</Link>
              </Button>
            </>
          ) : null}

          {authenticated ? (
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

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-semibold text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{email}</p>
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
          ) : null}
        </div>
      </div>
      <Separator />
    </header>
  );
}
