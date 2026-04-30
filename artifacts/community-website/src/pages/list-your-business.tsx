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
  Zap,
  Facebook,
  ChevronDown,
  ChevronUp,
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

function WaButton({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <a
      href={WA_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold rounded-full transition-colors shadow-lg ${
        size === "lg"
          ? "px-8 py-4 text-lg"
          : "px-6 py-3 text-base"
      }`}
    >
      <MessageCircle className={size === "lg" ? "w-6 h-6" : "w-5 h-5"} />
      List my business on WhatsApp
    </a>
  );
}

export default function ListYourBusinessPage() {
  return (
    <>
      <Helmet>
        <title>List Your Business FREE — Tallaght Business Directory | What's Up Tallaght</title>
        <meta
          name="description"
          content="Add your Tallaght business to the WUT community directory for free. Just send us a WhatsApp. Go live within 24 hours and get an intro post on our Facebook page."
        />
      </Helmet>

      <div className="w-full flex flex-col bg-background pb-20">

        {/* ── Hero ── */}
        <section className="bg-zinc-800 text-white py-20 md:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 opacity-80" />
          <div className="container mx-auto px-4 text-center relative z-10 max-w-3xl flex flex-col items-center gap-7">
            <div className="inline-flex items-center gap-2 bg-[#25D366]/20 text-[#25D366] text-sm font-semibold px-4 py-1.5 rounded-full">
              <CheckCircle2 className="w-4 h-4" /> 100% Free · No Forms · Just WhatsApp
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              List Your Business in the<br />
              <span className="text-[#25D366]">Tallaght Community Directory</span>
            </h1>
            <p className="text-lg text-white/80 leading-relaxed max-w-xl">
              Reach local residents who are actively looking for businesses like yours. Send us one WhatsApp message — we'll handle the rest.
            </p>
            <WaButton size="lg" />
            <p className="text-white/50 text-sm">{WA_NUMBER} · Usually replies within a few hours</p>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="container mx-auto px-4 py-16 md:py-20 max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-3">How it works</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Three steps. No paperwork, no login, no waiting on hold.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                icon: <MessageCircle className="w-7 h-7 text-[#25D366]" />,
                title: "Send us a WhatsApp",
                desc: "Tell us your business name, what you do, your phone, website, address, and attach your logo if you have one.",
              },
              {
                step: "2",
                icon: <Zap className="w-7 h-7 text-yellow-500" />,
                title: "We build your listing",
                desc: "Our team reviews your submission and creates your directory profile — usually within 24 hours.",
              },
              {
                step: "3",
                icon: <Star className="w-7 h-7 text-primary" />,
                title: "You go live",
                desc: "Your listing goes live on the directory and we introduce your business to the Tallaght community on Facebook.",
              },
            ].map((s) => (
              <Card key={s.step} className="relative border shadow-sm overflow-hidden">
                <div className="absolute top-4 right-4 text-5xl font-black text-muted-foreground/10 select-none leading-none">
                  {s.step}
                </div>
                <CardContent className="p-7 flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    {s.icon}
                  </div>
                  <h3 className="text-lg font-bold">{s.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
                </CardContent>
              </Card>
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
                { icon: <CheckCircle2 className="w-5 h-5 text-primary" />, title: "Free. Forever.", desc: "No hidden fees. No subscriptions. List your business at zero cost." },
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
          <div className="container mx-auto px-4 text-center max-w-xl flex flex-col items-center gap-5">
            <h2 className="text-2xl md:text-3xl font-bold">Ready to get listed?</h2>
            <p className="text-muted-foreground">
              Send us one WhatsApp message. We'll do the rest.
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
          <p className="text-muted-foreground text-sm">
            Want to see what the directory looks like first?{" "}
            <Link href="/directory" className="text-primary font-medium hover:underline">
              Browse the Tallaght Business Directory →
            </Link>
          </p>
        </section>

        {/* ── Final CTA ── */}
        <section className="bg-zinc-800 text-white py-16">
          <div className="container mx-auto px-4 text-center max-w-xl flex flex-col items-center gap-6">
            <h2 className="text-3xl font-bold">List your business today</h2>
            <p className="text-white/70 leading-relaxed">
              Join the Tallaght community directory. Free, fast, and as simple as sending a WhatsApp.
            </p>
            <WaButton size="lg" />
            <p className="text-white/40 text-sm">{WA_NUMBER}</p>
          </div>
        </section>

      </div>
    </>
  );
}
