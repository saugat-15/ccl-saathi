import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of use for CCLSaathi — NAATI CCL bilingual practice platform.",
};

const EFFECTIVE_DATE = "1 May 2025";
const CONTACT_EMAIL = "saugatgiri15@gmail.com";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Legal
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Terms of Use</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: {EFFECTIVE_DATE}
        </p>

        <div className="mt-10 space-y-8 text-sm text-foreground leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using CCLSaathi (&ldquo;the Service&rdquo;, &ldquo;we&rdquo;,
              &ldquo;us&rdquo;), you agree to be bound by these Terms of Use. If you do not agree,
              please do not use the Service. These terms apply to all visitors, registered users, and
              subscribers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. Description of Service</h2>
            <p>
              CCLSaathi is an online practice platform designed to help candidates prepare for the
              NAATI CCL (Credentialed Community Language) exam. The Service provides audio dialogues,
              recording tools, and AI-generated feedback across a range of topic areas.
            </p>
            <p className="mt-2">
              CCLSaathi is an independent study aid and is <strong>not affiliated with, endorsed by,
                or connected to NAATI (National Accreditation Authority for Translators and
                Interpreters) or any official examining body.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. Accounts</h2>
            <p>
              You must create an account to access practice content. You agree to provide accurate
              information during registration and to keep your credentials secure. You are responsible
              for all activity that occurs under your account. Notify us immediately at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>{" "}
              if you suspect unauthorised access.
            </p>
            <p className="mt-2">
              Accounts are personal and non-transferable. You may not share your login with others or
              create accounts on behalf of third parties without our consent.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="mt-2 list-disc list-outside ml-5 space-y-1 text-muted-foreground">
              <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
              <li>
                Attempt to reverse-engineer, scrape, or extract content, audio files, or AI feedback
                in bulk.
              </li>
              <li>
                Share, resell, or redistribute practice dialogues, transcripts, or AI feedback
                without our express written permission.
              </li>
              <li>
                Upload recordings that contain offensive, defamatory, or illegal content.
              </li>
              <li>
                Attempt to circumvent account authentication, payment systems, or usage limits.
              </li>
            </ul>
            <p className="mt-2">
              We reserve the right to suspend or terminate accounts that violate these terms without
              prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              5. Recordings and AI Feedback
            </h2>
            <p>
              When you record an interpretation attempt, the audio is uploaded to secure cloud storage
              for the sole purpose of generating automated feedback. You retain ownership of your own
              voice recordings. By submitting a recording, you grant us a limited licence to process
              it for scoring and to display results to you.
            </p>
            <p className="mt-2">
              AI-generated feedback is produced by automated systems and is provided for{" "}
              <strong>practice and self-assessment purposes only.</strong> It is not a guarantee of
              exam performance, nor should it be relied upon as professional language assessment
              advice. Scores and suggestions may contain errors.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              6. Intellectual Property
            </h2>
            <p>
              All dialogue scripts, audio files, platform design, branding, and software are owned
              by or licensed to CCLSaathi. Nothing in these terms transfers any intellectual property
              rights to you. You may use the Service for your personal study only.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              7. Disclaimer of Warranties
            </h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
              warranties of any kind, express or implied. We do not warrant that the Service will be
              uninterrupted, error-free, or that any particular practice score will predict your
              NAATI CCL exam outcome. Use the Service as one tool among many in your preparation.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              8. Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by applicable law, CCLSaathi and its operators shall
              not be liable for any indirect, incidental, special, or consequential damages arising
              from your use of or inability to use the Service, including but not limited to loss of
              data, exam failure, or reliance on AI-generated feedback.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">9. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. When we make material changes, we will
              update the effective date above and, where appropriate, notify registered users by
              email. Continued use of the Service after changes constitutes acceptance of the revised
              terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">10. Governing Law</h2>
            <p>
              These terms are governed by the laws of Australia. Any disputes shall be subject to the
              non-exclusive jurisdiction of the courts of Australia.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">11. Contact</h2>
            <p>
              Questions about these terms? Email us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
