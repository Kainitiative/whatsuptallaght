import { useState } from "react";
import { Helmet } from "react-helmet-async";

const BASE_URL = import.meta.env.BASE_URL;

const SUBJECTS = [
  "General Enquiry",
  "Advertise With Us",
  "Report an Issue",
  "Press / Media",
  "Story Tip",
  "Other",
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", subscribe: false });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}api/public/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject || null,
          message: form.message.trim(),
          subscribeNewsletter: form.subscribe,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Could not connect. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow";

  return (
    <>
      <Helmet>
        <title>Contact Us | What's Up Tallaght</title>
        <meta name="description" content="Get in touch with What's Up Tallaght. Send us a story tip, advertise with us, or just say hello." />
      </Helmet>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Get in touch</h1>
          <p className="text-muted-foreground text-lg">
            Have a question, a story tip, or want to advertise? We'd love to hear from you.
          </p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-green-800 mb-2">Message sent!</h2>
            <p className="text-green-700">
              Thanks for reaching out. We'll get back to you as soon as we can.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Name <span className="text-destructive">*</span>
                </label>
                <input
                  className={inputClass}
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Email <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Subject</label>
              <select
                className={inputClass}
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
              >
                <option value="">Select a subject…</option>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Message <span className="text-destructive">*</span>
              </label>
              <textarea
                className={`${inputClass} min-h-[140px] resize-y`}
                placeholder="Tell us what's on your mind…"
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                required
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
                checked={form.subscribe}
                onChange={(e) => set("subscribe", e.target.checked)}
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Keep me updated with the What's Up Tallaght newsletter
              </span>
            </label>

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Sending…" : "Send message"}
            </button>
          </form>
        )}

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div className="bg-muted/50 rounded-xl p-5">
            <p className="font-semibold text-foreground mb-1">Send us a story</p>
            <p>Got something happening in Tallaght? WhatsApp us a message, photo, or voice note and we'll turn it into an article.</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-5">
            <p className="font-semibold text-foreground mb-1">Advertise with us</p>
            <p>Reach thousands of Tallaght residents. Get in touch to discuss rates and formats.</p>
          </div>
        </div>
      </div>
    </>
  );
}
