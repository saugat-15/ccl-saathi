import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AmplifyProvider from "./components/AmplifyProvider";
import AuthGuard from "./components/auth/AuthGuard";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ThemeProvider from "./components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cclsaathi.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CCLSaathi — NAATI CCL bilingual practice",
    template: "%s · CCLSaathi",
  },
  description:
    "Practice realistic interpreter-style dialogues for the NAATI CCL exam. Eight topic areas, audio segments, replay and self-assessment — on your schedule.",
  openGraph: {
    title: "CCLSaathi — NAATI CCL bilingual practice",
    description:
      "Structured audio translation exercises across eight real-life NAATI CCL topic areas.",
    type: "website",
    locale: "en_AU",
    siteName: "CCLSaathi",
  },
  twitter: {
    card: "summary_large_image",
    title: "CCLSaathi — NAATI CCL bilingual practice",
    description:
      "Practice realistic bilingual dialogues for the NAATI CCL exam.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AmplifyProvider>
            <AuthGuard>
              <Navbar />
              {children}
              <Footer />
            </AuthGuard>
          </AmplifyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
