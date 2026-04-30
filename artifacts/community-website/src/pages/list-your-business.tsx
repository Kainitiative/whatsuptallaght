import { Helmet } from "react-helmet-async";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageCircle,
  CheckCircle2,
  Star,
  Clock,
  Globe,
  Phone,
  MapPin,
  Image,
  Tag,
  Facebook,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Flame,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const WA_LINK = "https://wa.me/353894366696";
const WA_NUMBER = "+353 89 436 6696";

const CATEGORIES = [
  { emoji: "🔨", name: "Trades & Construction" },
  { emoji: "🍽️", name: "Food & Drink" },
  { emoji: "💊", name: "Health & Wellness" },
  { emoji: "💇", name: "Beauty & Hair" },
  { emoji: "💻", name: "Technology & IT" },
  { emoji: "🛍️", name: "Retail & Shopping" },
  { emoji: "📋", name: "Professional Services" },
  { emoji: "🧒", name: "Childcare & Education" },
  { emoji: "⚽", name: "Sport & Fitness" },
  { emoji: "🤝", name: "Community & Charity" },
  { emoji: "🚚", name: "Transport & Logistics" },
  { emoji: "📦", name: "Other" },
];

const FAQS = [
  {
    q: "How much does it cost?",
    a: "Completely free. There are no fees to list your business or organisation in the WUT directory. We believe local businesses should be easy for local people to find.",
  },
  {
    q: "How do I submit my business?",
    a: "Just send us a WhatsApp message on +353 89 436 6696. Tell us your business name, what you do, your phone number, website, and address. Attach your logo if you have one. That's it — no forms, no signup required.",
  },
  {
    q: "How long does it take to go live?",
    a: "Most listings are reviewed and approved within 24 hours. Once approved, your listing goes live on the directory and we post an introduction on our Facebook page.",
  },
  {
    q: "How long does the listing last?",
    a: "Each listing is valid for one year. We'll reach out before it expires to let you know and give you the option to renew.",
  },
  {
    q: "Can I update my details after going live?",
    a: "Yes. Just send us a WhatsApp with the changes and we'll update your listing promptly.",
  },
  {
    q: "Can community groups and charities list too?",
    a: "Absolutely. The directory is open to any local business, community group, charity, club or organisation based in or serving the Tallaght area.",
  },
  {
    q: "What happens when you approve my listing?",
    a: "You get a WhatsApp notification with your live listing link, and we post an introduction to the Tallaght community on our Facebook page — giving you an immediate reach boost.",
  },
  {
    q: "Does my business have to be based in Tallaght?",
    a: "Your business should serve the Tallaght area. If you're based nearby but serve Tallaght residents, we'll still consider your listing.",
  },
];

const STEPS = [
  {
    n: "1",
    icon: "💬",
    title: "Send us your business on WhatsApp",
    desc: "Tell us your name, what you do, your phone, website, and address. Attach your logo if you have one.",
  },
  {
    n: "2",
    icon: "✅",
    title: "We review and create your listing",
    desc: "Our team checks your details and builds your directory profile — usually within 24 hours.",
  },
  {
    n: "3",
    icon: "🌐",
    title: "Your business goes live on our site",
    desc: "You get your own page at whatsuptallaght.ie with your full details and a WhatsApp notification with the link.",
  },
  {
    n: "4",
    icon: "📣",
    title: "We promote it on Facebook",
    desc: "We post an introduction to the Tallaght community on our Facebook page so you get an immediate reach boost.",
  },
  {
    n: "5",
    icon: "🏠",
    title: "Locals discover and contact you",
    desc: "Tallaght residents searching for businesses like yours find you on the directory and get in touch.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border rounded-xl overflow-hidden bg-card cursor-pointer"
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex items-center justify-between p-5 gap-4">
        <span className="font-semibold text-foreground">{q}</span>
        {open ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
        )}
      </div>
      {open && (
        <div className="px-5 pb-5 text-muted-foreground leading-relaxed border-t pt-4">
          {a}
        </div>
      )}
    </div>
  );
}

function WaButton({ size = "lg", label }: { size?: "lg" | "sm"; label?: string }) {
  return (
    <a
      href={WA_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold rounded-full transition-colors shadow-lg ${
        size === "lg" ? "px-8 py-4 text-lg" : "px-6 py-3 text-base"
      }`}
    >
      <MessageCircle className={size === "lg" ? "w-6 h-6" : "w-5 h-5"} />
      {label ?? "Get my business listed — free"}
    </a>
  );
}

export default function ListYourBusinessPage() {
  return (
    <>
      <Helmet>
        <title>Get Your Business Promoted in Tallaght — For Free | What's Up Tallaght</title>
        <meta
          name="description"
          content="List your Tallaght business for free on What's Up Tallaght. Get your own page, a directory listing, and a Facebook intro post. Just send us a WhatsApp — no forms, no accounts."
        />
      </Helmet>

      <div className="w-full flex flex-col bg-background pb-20">

        {/* ── Urgency banner ── */}
        <div className="bg-amber-500 text-white text-sm font-semibold py-2.5 text-center flex items-center justify-center gap-2">
          <Flame className="w-4 h-4 shrink-0" />
          We're currently building out the Tallaght directory — early listings get the most visibility.
        </div>

        {/* ── Hero ── */}
        <section className="bg-zinc-800 text-white py-20 md:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 opacity-80" />
          <div className="container mx-auto px-4 relative z-10 max-w-4xl flex flex-col md:flex-row items-center gap-12">

            {/* Left: headline + benefits */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 bg-[#25D366]/20 text-[#25D366] text-sm font-semibold px-4 py-1.5 rounded-full w-fit">
                <CheckCircle2 className="w-4 h-4" /> 100% Free
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
                Get Your Business<br />
                Promoted in Tallaght<br />
                <span className="text-[#25D366]">— For Free</span>
              </h1>
              <p className="text-white/70 text-base leading-relaxed">
                Send us a WhatsApp with your business details and we'll:
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  "Create your own page on What's Up Tallaght",
                  "Add you to our local business directory",
                  "Share your business on our Facebook page",
                  "Help local people discover you",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3 text-white/90 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-[#25D366] shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
              <p className="text-white/50 text-sm">No forms. No accounts. No hassle.</p>
            </div>

            {/* Right: CTA card */}
            <div className="w-full md:w-80 bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl p-8 flex flex-col items-center gap-5 text-center shrink-0">
              <div className="text-5xl">📲</div>
              <p className="font-bold text-lg leading-snug">
                Just send us a message on WhatsApp to get started
              </p>
              <WaButton size="lg" />
              <p className="text-white/40 text-xs">{WA_NUMBER}<br />Usually replies within a few hours</p>
            </div>

          </div>
        </section>

        {/* ── How it works ── */}
        <section className="container mx-auto px-4 py-16 md:py-20 max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-3">How it works</h2>
          <p className="text-center text-muted-foreground mb-12">
            From WhatsApp message to local customers — in five steps.
          </p>

          <div className="flex flex-col gap-0">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex gap-5 items-start">
                {/* Line + number */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 text-white flex items-center justify-center font-black text-sm shrink-0 z-10">
                    {s.n}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-0.5 flex-1 bg-border my-1 min-h-[2rem]" />
                  )}
                </div>
                {/* Content */}
                <div className={`pb-8 flex-1 ${i === STEPS.length - 1 ? "pb-0" : ""}`}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-2xl">{s.icon}</span>
                    <h3 className="font-bold text-foreground">{s.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── What you get ── */}
        <section className="bg-muted/50 border-y py-16 md:py-20">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-3">What's included in your listing</h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              Everything a local customer needs to find and contact you.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: <Star className="w-5 h-5 text-primary" />, title: "Business name & description", desc: "A friendly, SEO-optimised blurb about what you do." },
                { icon: <Image className="w-5 h-5 text-primary" />, title: "Logo / photo", desc: "Your image front and centre on your listing card and profile." },
                { icon: <Phone className="w-5 h-5 text-primary" />, title: "Phone number", desc: "Tap-to-call directly from the listing on mobile." },
                { icon: <Globe className="w-5 h-5 text-primary" />, title: "Website link", desc: "Direct link to your website so customers can learn more." },
                { icon: <MapPin className="w-5 h-5 text-primary" />, title: "Address & area", desc: "Your location shown clearly so locals know you're nearby." },
                { icon: <Tag className="w-5 h-5 text-primary" />, title: "Category & search", desc: "Listed under the right category and discoverable by search." },
                { icon: <Facebook className="w-5 h-5 text-primary" />, title: "Facebook intro post", desc: "We post an intro to our Tallaght Facebook community when you go live." },
                { icon: <Clock className="w-5 h-5 text-primary" />, title: "1-year listing", desc: "Your listing stays live for a full year. We remind you before it expires." },
                { icon: <CheckCircle2 className="w-5 h-5 text-primary" />, title: "Free. Always.", desc: "No hidden fees. No subscriptions. List your business at zero cost." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4 bg-card border rounded-xl p-5">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{item.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Categories ── */}
        <section className="container mx-auto px-4 py-16 md:py-20 max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-3">All types of businesses welcome</h2>
          <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto">
            Sole traders, SMEs, community groups, charities, clubs — if you serve Tallaght, you belong here.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {CATEGORIES.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-3 bg-card border rounded-xl px-4 py-3 text-sm font-medium"
              >
                <span className="text-xl">{c.emoji}</span>
                <span className="text-foreground/80">{c.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Mid CTA ── */}
        <section className="bg-[#25D366]/10 border-y border-[#25D366]/20 py-14">
          <div className="container mx-auto px-4 text-center max-w-xl flex flex-col items-center gap-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#25D366]">Early listings get the most visibility</p>
            <h2 className="text-2xl md:text-3xl font-bold">Ready to get listed?</h2>
            <p className="text-muted-foreground">
              Send us one WhatsApp. No forms, no accounts — we'll handle the rest.
            </p>
            <WaButton size="lg" />
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="container mx-auto px-4 py-16 md:py-20 max-w-2xl">
          <h2 className="text-3xl font-bold text-center mb-10">Frequently asked questions</h2>
          <div className="flex flex-col gap-3">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </section>

        {/* ── Browse existing ── */}
        <section className="container mx-auto px-4 pb-8 max-w-2xl text-center">
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-1.5">
            Want to see what the directory looks like first?{" "}
            <Link href="/directory" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
              Browse the Tallaght Business Directory <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </p>
        </section>

        {/* ── Final CTA ── */}
        <section className="bg-zinc-800 text-white py-16">
          <div className="container mx-auto px-4 text-center max-w-xl flex flex-col items-center gap-6">
            <h2 className="text-3xl font-bold">Get your business in front of Tallaght</h2>
            <p className="text-white/70 leading-relaxed">
              Free. Fast. As simple as sending a WhatsApp.
            </p>
            <WaButton size="lg" />
            <p className="text-white/40 text-sm">{WA_NUMBER}</p>
          </div>
        </section>

      </div>
    </>
  );
}
