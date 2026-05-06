import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-muted/20">
      <div className="max-w-6xl mx-auto px-5 py-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
          <div className="max-w-sm">
            <p className="font-bold text-lg tracking-tight">
              CCL<span className="text-primary">Saathi</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Bilingual dialogue practice for the NAATI CCL exam — structured audio, real topics,
              self-paced review.
            </p>
          </div>
          <div className="flex flex-wrap gap-8 text-sm">
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Product</p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>
                  <Link href="/#features" className="hover:text-foreground transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-foreground transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/#practice" className="hover:text-foreground transition-colors">
                    Categories
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Legal</p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>
                  <Link href="/privacy" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground transition-colors">
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-10 pt-8 border-t border-border text-xs text-muted-foreground">
          © {new Date().getFullYear()} CCLSaathi. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
