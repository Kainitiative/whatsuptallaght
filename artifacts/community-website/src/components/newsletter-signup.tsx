import { useState } from "react";

const BASE_URL = import.meta.env.BASE_URL;

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}api/public/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-zinc-900 text-white py-10 px-4">
      <div className="container mx-auto max-w-xl text-center">
        <h3 className="text-lg font-bold mb-1">Get Tallaght news in your inbox</h3>
        <p className="text-white/60 text-sm mb-5">Join the community. Be the first to know.</p>
        {done ? (
          <p className="text-[#25d366] font-semibold text-sm">You're subscribed! Thanks for joining.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 justify-center flex-wrap">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="your@email.com"
              className="flex-1 min-w-0 max-w-xs px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#25d366]/50"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#25d366] hover:bg-[#20bd5a] text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? "…" : "Subscribe"}
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}
