import { CategoryFilter } from "@/components/category-filter";

export default function Terms() {
  return (
    <div className="w-full flex flex-col bg-background pb-20">
      <CategoryFilter />
      <div className="container mx-auto px-4 max-w-3xl py-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Use</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: April 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-8">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Who we are</h2>
            <p>Tallaght Community Hub is a local community news platform for Tallaght, Dublin, Ireland. We publish stories, updates, and information submitted by local residents via WhatsApp and other channels.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Submitting content</h2>
            <p>When you send us a message, photo, or voice note via WhatsApp, you are submitting content for potential publication. By doing so, you agree that:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Your submission may be edited, rewritten, or summarised by our team or AI tools before publication.</li>
              <li>Your submission may be published on this website, our social media channels, and in our newsletter.</li>
              <li>Your name will not be published unless you explicitly provide it and we confirm its use with you.</li>
              <li>You own the rights to the content you submit, or have permission to share it.</li>
              <li>You will not submit content that is false, defamatory, harmful, or illegal.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Editorial control</h2>
            <p>We reserve the right to reject, edit, or remove any submission at our discretion. We do not guarantee publication of any submitted content.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Accuracy</h2>
            <p>We make reasonable efforts to verify information before publishing. However, we rely on submissions from community members and cannot always independently verify every claim. Published articles may reflect the views of the submitter and do not necessarily represent the views of Tallaght Community Hub.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Limitation of liability</h2>
            <p>Tallaght Community Hub acts as a platform for community-submitted information. While we moderate and review content, we are not responsible for the accuracy of user submissions. We disclaim liability for any loss, damage, or harm arising from published content to the fullest extent permitted by law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Prohibited content</h2>
            <p>You must not submit content that:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Is false, misleading, or defamatory</li>
              <li>Harasses, threatens, or targets any individual</li>
              <li>Is discriminatory on the basis of race, religion, gender, sexuality, disability, or any other characteristic</li>
              <li>Promotes illegal activity</li>
              <li>Infringes the copyright or privacy of any third party</li>
            </ul>
            <p className="mt-3">Submissions that violate these rules will be removed and the contributor may be blocked from submitting further content.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Withdrawing consent</h2>
            <p>You may withdraw your consent to publish at any time by contacting us. To stop receiving messages from our WhatsApp number, reply <strong>STOP</strong> at any time.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Changes to these terms</h2>
            <p>We may update these terms from time to time. Continued use of our WhatsApp submission service after changes are published constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
            <p>If you have questions about these terms, contact us via WhatsApp or through our social media channels.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
