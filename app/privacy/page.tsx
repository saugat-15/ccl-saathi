import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for CCLSaathi: how we collect, use, and protect your data.",
};

const EFFECTIVE_DATE = "1 May 2025";
const CONTACT_EMAIL = "saugatgiri15@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Legal
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: {EFFECTIVE_DATE}
        </p>

        <div className="mt-10 space-y-8 text-sm text-foreground leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Overview</h2>
            <p>
              CCLSaathi (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is committed to protecting your
              privacy. This policy explains what personal information we collect when you use the
              Service, how we use it, and your rights regarding that information. We are based in
              Australia and handle your data in accordance with the{" "}
              <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. Information We Collect</h2>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-1">Account information</h3>
            <p>
              When you register, we collect your email address, first name, and last name. This is
              stored in AWS Cognito and is used to authenticate you and personalise your experience.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-1">Audio recordings</h3>
            <p>
              When you submit a practice attempt, your audio recording is uploaded to secure AWS S3
              storage. Recordings are processed by automated transcription and AI scoring services
              and then retained so you can review your history. We do not use your recordings to
              train AI models or share them with third parties outside of the processing pipeline.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-1">Usage data</h3>
            <p>
              We collect standard server logs and may collect anonymised analytics (e.g., pages
              visited, features used) to understand how the Service is used and to improve it. This
              data does not identify you personally.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-1">Waitlist</h3>
            <p>
              If you submit your email address via the waitlist form, that email is stored securely
              and used only to notify you about launch updates. You can ask us to remove it at any
              time.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc list-outside ml-5 space-y-1 text-muted-foreground">
              <li>To create and manage your account.</li>
              <li>To process your recordings and generate AI feedback scores.</li>
              <li>To display your attempt history and progress.</li>
              <li>To send transactional emails (e.g., account confirmation, password reset).</li>
              <li>To improve the quality and reliability of the Service.</li>
              <li>To comply with legal obligations.</li>
            </ul>
            <p className="mt-2">
              We do not sell your personal information to third parties. We do not use your data for
              targeted advertising.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              4. Third-Party Services
            </h2>
            <p>
              We use the following third-party services to operate CCLSaathi. Each handles data
              under its own privacy policy:
            </p>
            <ul className="mt-2 list-disc list-outside ml-5 space-y-1 text-muted-foreground">
              <li>
                <strong>AWS (Amazon Web Services)</strong>: authentication (Cognito), database
                (DynamoDB via AppSync), file storage (S3), and serverless compute (Lambda). Data is
                stored in the AWS ap-southeast-2 (Sydney) region.
              </li>
              <li>
                <strong>OpenAI</strong>: audio recordings are sent to the Whisper API for
                transcription. OpenAI&rsquo;s API data usage policy applies.
              </li>
              <li>
                <strong>Anthropic</strong>: transcripts are sent to the Claude API for scoring and
                feedback generation. Anthropic&rsquo;s API data usage policy applies.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Data Retention</h2>
            <p>
              We retain your account information and recordings for as long as your account is
              active. If you delete your account, your personal data and recordings will be removed
              within 30 days, except where we are required to retain it by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Security</h2>
            <p>
              We apply industry-standard security measures including encrypted data transmission
              (HTTPS/TLS), server-side encryption for files in S3, and access controls on all
              backend resources. Despite these measures, no system is completely secure, and we
              cannot guarantee absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="mt-2 list-disc list-outside ml-5 space-y-1 text-muted-foreground">
              <li>Access the personal information we hold about you.</li>
              <li>Request correction of inaccurate information.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Withdraw consent for any optional data uses.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, email us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              8. Children&rsquo;s Privacy
            </h2>
            <p>
              CCLSaathi is intended for users who are 18 years of age or older. We do not knowingly
              collect personal information from children under 18. If you believe a child has
              registered, please contact us and we will delete that account promptly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this policy from time to time. We will notify registered users of
              material changes by email and update the effective date above. Continued use of the
              Service after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">10. Contact</h2>
            <p>
              For privacy-related questions or requests, contact us at{" "}
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
