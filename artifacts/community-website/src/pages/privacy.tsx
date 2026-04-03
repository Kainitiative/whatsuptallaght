import { CategoryFilter } from "@/components/category-filter";

export default function Privacy() {
  return (
    <div className="w-full flex flex-col bg-background pb-20">
      <CategoryFilter />
      <div className="container mx-auto px-4 max-w-3xl py-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: April 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-8">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Who we are</h2>
            <p>Tallaght Community Hub is a local community news platform based in Tallaght, Dublin, Ireland. This policy explains how we collect, use, and protect your personal data.</p>
            <p className="mt-2">We are committed to protecting your privacy and complying with the General Data Protection Regulation (GDPR) and Irish data protection law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. What data we collect</h2>
            <p>When you contact us via WhatsApp, we collect:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Your phone number</strong> — stored as an irreversible cryptographic hash. We cannot recover your actual number from what we store.</li>
              <li><strong>Your display name</strong> — as provided by WhatsApp, if available.</li>
              <li><strong>Message content</strong> — text, photos, and voice notes you send to us.</li>
              <li><strong>Consent record</strong> — the date and time you agreed to our terms.</li>
            </ul>
            <p className="mt-3">If you sign up to our newsletter, we also collect your email address.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How we use your data</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To process and publish your submissions as community news articles.</li>
              <li>To send you reply messages confirming receipt or publication of your story.</li>
              <li>To send our monthly newsletter if you have subscribed.</li>
              <li>To detect and prevent misuse of our platform.</li>
            </ul>
            <p className="mt-3">We do not sell your data to third parties. We do not use your data for advertising.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. AI processing</h2>
            <p>Submissions are processed using AI tools (including OpenAI's services) to assist with writing and editing articles. Your message content is sent to these services as part of that process. OpenAI's data handling is governed by their own privacy policy.</p>
            <p className="mt-2">Published articles are written by AI based on your submission and do not reproduce your original message verbatim.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Anonymity</h2>
            <p>Published articles do not include your phone number, name, or any personally identifying information unless you have explicitly provided your name and agreed to its use. Contributors are referred to as "a local resident" or "a community member" by default.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data retention</h2>
            <p>We retain submission records for as long as the associated article remains published, or for up to 2 years. You may request deletion of your data at any time (see Section 8).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your rights under GDPR</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Access</strong> — request a copy of the data we hold about you</li>
              <li><strong>Rectification</strong> — request correction of inaccurate data</li>
              <li><strong>Erasure</strong> — request deletion of your data ("right to be forgotten")</li>
              <li><strong>Restriction</strong> — request that we limit how we use your data</li>
              <li><strong>Objection</strong> — object to our processing of your data</li>
              <li><strong>Portability</strong> — request your data in a portable format</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us via WhatsApp or our social media channels. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Withdrawing consent</h2>
            <p>You may withdraw your consent at any time by replying <strong>STOP</strong> to our WhatsApp number. This will stop us from sending you messages. To request deletion of your submission history, contact us directly.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Cookies</h2>
            <p>Our website uses only functional cookies necessary for the site to work. We do not use tracking or advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact & complaints</h2>
            <p>If you have questions or concerns about how we handle your data, contact us via WhatsApp or our social media channels.</p>
            <p className="mt-2">You also have the right to lodge a complaint with the Data Protection Commission (DPC) at <a href="https://www.dataprotection.ie" target="_blank" rel="noreferrer" className="text-primary hover:underline">dataprotection.ie</a>.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
