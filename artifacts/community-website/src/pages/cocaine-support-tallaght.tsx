import { useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  AlertTriangle,
  Phone,
  Heart,
  Brain,
  Users,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowRight,
  CircleHelp,
  MessageCircle,
  HandHeart,
  Info,
  Zap,
} from "lucide-react";

// ── Quick-links anchor nav ────────────────────────────────────────────────────

const SECTIONS = [
  { id: "why-now", label: "Why It Matters" },
  { id: "mental-health", label: "Mental Health Effects" },
  { id: "physical-health", label: "Physical Effects" },
  { id: "warning-signs", label: "Warning Signs" },
  { id: "families", label: "Families & Relationships" },
  { id: "recovery", label: "Recovery" },
  { id: "services", label: "Local Services" },
  { id: "crisis", label: "Crisis Support" },
  { id: "faq", label: "FAQ" },
];

// ── Local services ────────────────────────────────────────────────────────────

const SERVICES = [
  {
    name: "Tallaght Rehabilitation Project (TRP)",
    location: "Kiltalown House, Tallaght",
    description:
      "A community-based addiction recovery and aftercare service rooted in Tallaght. TRP works with people at all stages of their recovery journey.",
    services: [
      "Rehabilitation & recovery support",
      "Aftercare programmes",
      "Personal development",
      "Community reintegration",
      "Group work",
    ],
    url: "https://www.tallaghtrehabproject.ie",
    highlight: true,
  },
  {
    name: "Community Addiction Response Programme (CARP)",
    location: "Killinarden, Tallaght",
    description:
      "A community-based addiction support service operating in Killinarden, part of the wider addiction response network across Tallaght.",
    services: [
      "Addiction support",
      "Family support",
      "Outreach",
      "Community education",
      "Recovery support",
    ],
    url: null,
    highlight: false,
  },
  {
    name: "Tallaght Drug & Alcohol Task Force (TDATF)",
    location: "Tallaght",
    description:
      "Coordinates prevention, rehabilitation, education, family support, and addiction-response initiatives across the Tallaght area.",
    services: [
      "Prevention programmes",
      "Rehabilitation coordination",
      "Family support",
      "Education initiatives",
      "Addiction response",
    ],
    url: "https://www.tallaghtdatf.ie",
    highlight: false,
  },
  {
    name: "HSE Addiction Services",
    location: "South West Dublin",
    description:
      "The HSE South West Dublin Drug and Alcohol Service provides assessment, addiction support pathways, and referrals across the region.",
    services: [
      "Assessment & referral",
      "Addiction support pathways",
      "Medical support",
      "Recovery planning",
    ],
    url: "https://www2.hse.ie/services/south-west-dublin-drug-and-alcohol-service/",
    highlight: false,
  },
  {
    name: "Cocaine Anonymous Ireland",
    location: "Meetings across Ireland",
    description:
      "Free peer-support recovery meetings for people struggling with cocaine addiction and related substance use. No fees, no registration — just support.",
    services: [
      "Free peer-support meetings",
      "Anonymous participation",
      "Recovery fellowship",
      "Ongoing community support",
    ],
    url: "https://www.ca-ireland.org",
    highlight: false,
  },
  {
    name: "Narcotics Anonymous Ireland",
    location: "Meetings across Ireland",
    description:
      "Free, anonymous peer-support recovery meetings for people recovering from any form of addiction.",
    services: [
      "Free anonymous meetings",
      "Recovery fellowship",
      "Peer support",
      "Ongoing community connection",
    ],
    url: "https://www.na-ireland.org",
    highlight: false,
  },
  {
    name: "Drugs.ie",
    location: "National — online & helpline",
    description:
      "Ireland's national drugs information and support service, providing information, family guidance, and support resources.",
    services: [
      "Information & guidance",
      "Family support resources",
      "Online support",
      "Signposting to services",
    ],
    url: "https://www.drugs.ie",
    highlight: false,
  },
];

// ── FAQ data ──────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "Can cocaine cause anxiety?",
    a: "Yes. Cocaine can contribute to anxiety, panic attacks, emotional crashes, and paranoia — particularly during repeated use or after binges. Many people do not initially connect these experiences to cocaine use, and may believe they are simply burnt out or stressed.",
  },
  {
    q: "Can cocaine cause psychosis?",
    a: "In some people, particularly during heavy use or prolonged sleep deprivation, cocaine can contribute to hallucinations, paranoia, and drug-induced psychosis. These experiences feel completely real. Anyone experiencing these symptoms needs urgent support — call 999 or 112 immediately.",
  },
  {
    q: "Can people recover from cocaine addiction?",
    a: "Yes. Many people recover through community support, counselling, peer recovery, rehabilitation programmes, healthcare support, and recovery networks. Recovery is not about perfection — it is about support, structure, honesty, and rebuilding life gradually.",
  },
  {
    q: "What if I am embarrassed to ask for help?",
    a: "Many people delay asking for support because of shame or fear of judgement. Support services in Tallaght deal with addiction every day and are there to help — not judge. Reaching out is a step toward support, safety, and stability.",
  },
  {
    q: "Are recovery meetings free?",
    a: "Yes. Peer-support meetings such as Cocaine Anonymous, Narcotics Anonymous, and Alcoholics Anonymous are completely free to attend. No registration, no fees.",
  },
  {
    q: "What if I am worried about someone else?",
    a: "You do not need to manage this alone. Family support services and addiction services in Tallaght can help guide conversations and next steps. Choose a calm moment to talk, focus on concern rather than accusation, and encourage support rather than confrontation.",
  },
  {
    q: "What is the difference between cocaine use and cocaine addiction?",
    a: "Cocaine use can begin occasionally and socially. Addiction develops when use becomes compulsive, increasingly difficult to control, or when stopping causes significant distress. Many people continue functioning publicly while struggling privately — which can delay seeking help.",
  },
];

// ── FAQ accordion item ────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 text-sm md:text-base leading-snug">{q}</span>
        {open ? (
          <ChevronUp className="w-5 h-5 text-teal-600 shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-6 pb-5 bg-white">
          <p className="text-slate-600 leading-relaxed text-sm md:text-base">{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CocaineSupportTallaghtPage() {
  return (
    <>
      <Helmet>
        <title>Cocaine Support Tallaght | Recovery, Mental Health & Local Help</title>
        <meta
          name="description"
          content="Information on cocaine addiction, mental health, recovery, and support services in Tallaght including local help, family supports, and recovery pathways."
        />
      </Helmet>

      {/* ── Crisis banner ── */}
      <div className="bg-red-600 text-white">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-sm font-medium text-center">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            If someone is in immediate danger
          </span>
          <div className="flex items-center gap-4">
            <a href="tel:999" className="font-bold underline underline-offset-2 hover:text-red-100">Call 999</a>
            <span className="opacity-60">or</span>
            <a href="tel:112" className="font-bold underline underline-offset-2 hover:text-red-100">112</a>
            <span className="opacity-60 hidden sm:inline">·</span>
            <a href="tel:1800459459" className="font-bold underline underline-offset-2 hover:text-red-100 hidden sm:inline">HSE Helpline: 1800 459 459</a>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="bg-slate-900 text-white py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-teal-500/20 text-teal-300 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border border-teal-500/30">
              Community Health Resource
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-6">
            Cocaine in Tallaght:<br />
            <span className="text-teal-400">Awareness, Support & Recovery</span>
          </h1>
          <p className="text-slate-300 text-lg md:text-xl leading-relaxed mb-8 max-w-3xl">
            Cocaine use is being talked about more openly across Ireland than ever before. This page is not about judgement. It is about awareness, understanding the risks, and connecting people with the support and recovery services that exist right here in Tallaght.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: Heart, label: "Recovery is possible", color: "text-teal-400" },
              { icon: HandHeart, label: "Support exists locally", color: "text-teal-400" },
              { icon: Users, label: "Nobody faces it alone", color: "text-teal-400" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <Icon className={`w-5 h-5 ${color} shrink-0`} />
                <span className="text-white/90 text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Anchor nav ── */}
      <nav className="sticky top-16 z-40 bg-white border-b border-slate-200 shadow-sm overflow-x-auto">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 py-2 min-w-max">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs font-medium text-slate-600 hover:text-teal-700 hover:bg-teal-50 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 max-w-4xl py-12 space-y-20">

        {/* ── Why now ── */}
        <section id="why-now">
          <SectionHeader icon={Info} label="Understanding the Issue" title="Why Cocaine Is Being Talked About More" color="teal" />
          <div className="prose-content space-y-5 text-slate-700 leading-relaxed">
            <p>
              Cocaine use in Ireland has increased significantly over the last decade. Recovery and treatment organisations report growing numbers of people seeking support for cocaine addiction, anxiety related to cocaine use, and mental health difficulties linked to stimulant use.
            </p>
            <p>
              One of the reasons cocaine addiction can become serious before support is sought is because many people continue functioning publicly while struggling privately.
            </p>
            <div className="grid md:grid-cols-2 gap-6 my-8">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <p className="font-semibold text-slate-800 mb-4">Many people continue publicly:</p>
                <ul className="space-y-2">
                  {["Working", "Parenting", "Socialising", "Paying bills", "Appearing 'fine'"].map((i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />{i}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <p className="font-semibold text-slate-800 mb-4">While privately dealing with:</p>
                <ul className="space-y-2">
                  {["Anxiety & panic attacks", "Paranoia", "Emotional crashes", "Debt", "Sleep problems", "Relationship strain", "Increasing dependence"].map((i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />{i}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="bg-teal-50 border-l-4 border-teal-500 rounded-r-xl px-6 py-5">
              <p className="text-teal-900 font-medium leading-relaxed">
                According to reports connected to Coolmine Therapeutic Community, <strong>57% of men entering residential treatment</strong> were primarily seeking help for cocaine addiction — highlighting that cocaine addiction is not isolated. It affects people from many different backgrounds, ages, professions, and communities.
              </p>
            </div>
          </div>
        </section>

        {/* ── Mental health effects ── */}
        <section id="mental-health">
          <SectionHeader icon={Brain} label="Mental Wellbeing" title="The Hidden Mental Health Effects" color="teal" />
          <p className="text-slate-700 leading-relaxed mb-8">
            Many people associate cocaine only with confidence, energy, or nightlife. What is discussed less often are the mental and emotional effects that can develop during or after repeated use — effects that people often do not initially connect to cocaine at all.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Cocaine affects brain chemicals involved in:
              </h3>
              <ul className="space-y-2">
                {["Reward & mood", "Stress responses", "Alertness", "Fear responses", "Emotional regulation"].map((i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />{i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Repeated use can contribute to:
              </h3>
              <ul className="space-y-2">
                {["Anxiety & panic attacks", "Paranoia", "Emotional instability", "Irritability", "Depression after use", "Emotional numbness", "Exhaustion"].map((i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />{i}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
            <h3 className="font-bold text-amber-900 mb-3">Cocaine, Anxiety & Paranoia</h3>
            <p className="text-amber-800 text-sm leading-relaxed mb-4">
              Anxiety and paranoia are among the most commonly reported psychological effects. Long sessions without sleep can intensify these effects significantly. Sleep deprivation combined with stimulant use can leave people emotionally overwhelmed, exhausted, agitated, and mentally distressed.
            </p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {["Racing thoughts & overthinking", "Fear and suspicion", "Panic attacks", "Inability to calm down", "Feeling watched or judged", "Intense social anxiety", "Emotional crashes after weekends"].map((i) => (
                <li key={i} className="text-sm text-amber-800 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />{i}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <h3 className="font-bold text-red-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Cocaine Psychosis & Severe Mental Health Risks
            </h3>
            <p className="text-red-800 text-sm leading-relaxed mb-4">
              Heavy cocaine use, repeated binges, and long periods without sleep can increase the risk of severe paranoia and cocaine-related psychosis — a temporary loss of touch with reality that can include hallucinations, hearing voices, and extreme fear.
            </p>
            <p className="text-red-800 text-sm leading-relaxed mb-4">
              People experiencing cocaine-related psychosis are not "crazy" or "bad." They may be frightened, overwhelmed, sleep-deprived, and in urgent need of support.
            </p>
            <div className="bg-red-100 rounded-xl px-5 py-4">
              <p className="font-semibold text-red-900 text-sm mb-2">Seek urgent medical support immediately if someone experiences:</p>
              <ul className="grid sm:grid-cols-2 gap-1.5">
                {["Hallucinations or hearing voices", "Severe paranoia", "Suicidal thoughts", "Collapse or seizures", "Chest pain", "Violent agitation", "Prolonged periods without sleep"].map((i) => (
                  <li key={i} className="text-sm text-red-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />{i}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 mt-4">
                <a href="tel:999" className="bg-red-600 text-white font-bold px-5 py-2.5 rounded-lg text-sm hover:bg-red-700 transition-colors">Call 999</a>
                <a href="tel:112" className="bg-red-600 text-white font-bold px-5 py-2.5 rounded-lg text-sm hover:bg-red-700 transition-colors">Call 112</a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Physical health ── */}
        <section id="physical-health">
          <SectionHeader icon={ShieldCheck} label="Physical Wellbeing" title="Physical Health Effects" color="teal" />
          <p className="text-slate-700 leading-relaxed mb-8">
            Cocaine does not only affect mental health. It can place major strain on the body and cardiovascular system. Many people underestimate the physical risks — particularly when cocaine is combined with alcohol.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              { title: "Immediate effects", items: ["Raised heart rate", "Chest pain", "Increased blood pressure", "Overheating", "Shortness of breath"] },
              { title: "When combined with alcohol", items: ["Impulsive behaviour", "Aggression", "Emotional instability", "Increased strain on the heart", "Risky decision-making"] },
              { title: "Long-term effects", items: ["Difficulty concentrating", "Memory problems", "Impulse control difficulties", "Emotional regulation issues", "Sleep disruption"] },
            ].map(({ title, items }) => (
              <div key={title} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <p className="font-semibold text-slate-800 text-sm mb-3">{title}</p>
                <ul className="space-y-2">
                  {items.map((i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0 mt-1.5" />{i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── Warning signs ── */}
        <section id="warning-signs">
          <SectionHeader icon={AlertTriangle} label="Recognising Difficulty" title="Signs Someone May Be Struggling" color="amber" />
          <p className="text-slate-700 leading-relaxed mb-6">
            Cocaine addiction can remain hidden for long periods. There is no single sign that proves someone is struggling — but repeated patterns of behavioural, emotional, financial, or mental health changes may indicate someone needs support.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
              {[
                "Mood swings", "Secrecy", "Emotional crashes", "Increased anxiety",
                "Irritability", "Staying awake all night", "Sleeping excessively after weekends",
                "Withdrawing from family life", "Financial pressure", "Borrowing money frequently",
                "Sudden debt", "Panic attacks", "Paranoia", "Increased alcohol use", "Loss of routine",
              ].map((i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-900">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />{i}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4">
            <p className="text-slate-600 text-sm leading-relaxed">
              <strong>Important:</strong> These signs do not automatically mean cocaine addiction. They may indicate someone is struggling emotionally, mentally, or physically — and may benefit from support, regardless of the cause.
            </p>
          </div>
        </section>

        {/* ── Families ── */}
        <section id="families">
          <SectionHeader icon={Users} label="Support for Families" title="The Impact on Families & Relationships" color="teal" />
          <p className="text-slate-700 leading-relaxed mb-8">
            Addiction rarely affects one person alone. Families often carry enormous emotional stress while trying to support someone who is struggling. Children are often deeply affected by instability, tension, or emotional absence — even when addiction is never openly discussed.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4">Partners, parents & loved ones may experience:</h3>
              <ul className="space-y-2">
                {["Fear and anxiety", "Exhaustion and confusion", "Helplessness", "Financial stress", "Emotional burnout", "Relationship strain", "Loss of trust"].map((i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />{i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-6">
              <h3 className="font-semibold text-teal-900 mb-4">How to approach someone you are worried about</h3>
              <ul className="space-y-2">
                {[
                  "Choose a calm moment to talk",
                  "Focus on concern, not accusation",
                  "Avoid confronting during intoxication",
                  "Avoid shaming language",
                  "Encourage conversation about support",
                  "Stay calm and realistic",
                ].map((i) => (
                  <li key={i} className="text-sm text-teal-800 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0 mt-1.5" />{i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-slate-900 text-white rounded-2xl px-6 py-5">
            <p className="font-semibold text-lg mb-1">Families are not expected to carry addiction alone.</p>
            <p className="text-slate-400 text-sm">Support exists for families as well as for individuals. Recovery conversations may take time — sometimes the first step is simply helping someone realise support exists.</p>
          </div>
        </section>

        {/* ── Recovery ── */}
        <section id="recovery">
          <SectionHeader icon={Heart} label="Hope & Recovery" title="Recovery Is Possible" color="green" />
          <p className="text-slate-700 leading-relaxed mb-8">
            One of the most important things to understand is that people do recover from cocaine addiction. Recovery is not about perfection — it is about support, structure, honesty, community connection, and rebuilding life gradually.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[
              { title: "Counselling", desc: "One-to-one professional support addressing the emotional and psychological aspects of addiction." },
              { title: "Peer Recovery", desc: "Connecting with others who have lived experience of addiction and recovery — reducing isolation." },
              { title: "Rehabilitation", desc: "Structured programmes supporting people to rebuild stability, routine, and confidence." },
              { title: "Family Support", desc: "Support for families and loved ones alongside the person in recovery." },
              { title: "Mental Health Support", desc: "Addressing anxiety, depression, and psychological effects that often accompany recovery." },
              { title: "Community Reintegration", desc: "Education, employment pathways, and community connection to support long-term recovery." },
            ].map(({ title, desc }) => (
              <div key={title} className="bg-green-50 border border-green-200 rounded-2xl p-5">
                <p className="font-semibold text-green-900 mb-2">{title}</p>
                <p className="text-green-800 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-teal-50 border-l-4 border-teal-500 rounded-r-xl px-6 py-5">
            <p className="text-teal-900 font-medium leading-relaxed">
              Tallaght has a strong network of community-based organisations, rehabilitation projects, peer-support services, and recovery pathways. Recovery does not happen in isolation — community support plays a major role in helping people rebuild confidence, stability, connection, and hope.
            </p>
          </div>
        </section>

        {/* ── Services ── */}
        <section id="services">
          <SectionHeader icon={MessageCircle} label="Local Support" title="Recovery & Support Services in Tallaght" color="teal" />
          <p className="text-slate-700 leading-relaxed mb-8">
            The following services operate in Tallaght and across the wider South Dublin area. Whether you are seeking support for yourself, a family member, or someone you care about — help is available.
          </p>
          <div className="space-y-4">
            {SERVICES.map((s) => (
              <div
                key={s.name}
                className={`rounded-2xl border p-6 shadow-sm ${s.highlight ? "bg-teal-50 border-teal-300" : "bg-white border-slate-200"}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className={`font-bold text-lg ${s.highlight ? "text-teal-900" : "text-slate-800"}`}>{s.name}</h3>
                      {s.highlight && (
                        <span className="bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-teal-200">Tallaght-based</span>
                      )}
                    </div>
                    <p className={`text-sm mb-3 ${s.highlight ? "text-teal-800" : "text-slate-500"}`}>📍 {s.location}</p>
                    <p className={`text-sm leading-relaxed mb-4 ${s.highlight ? "text-teal-800" : "text-slate-600"}`}>{s.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {s.services.map((svc) => (
                        <span
                          key={svc}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.highlight ? "bg-teal-100 text-teal-800 border border-teal-200" : "bg-slate-100 text-slate-700 border border-slate-200"}`}
                        >
                          {svc}
                        </span>
                      ))}
                    </div>
                  </div>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors ${s.highlight ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                    >
                      Visit Website <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Crisis ── */}
        <section id="crisis">
          <div className="bg-red-600 text-white rounded-3xl p-8 md:p-10">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-white/20 rounded-2xl p-3 shrink-0">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <p className="text-red-100 text-sm font-semibold uppercase tracking-widest mb-1">Emergency & Crisis Support</p>
                <h2 className="text-2xl md:text-3xl font-bold">Seek help immediately if someone is experiencing:</h2>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mb-8">
              {[
                "Chest pain", "Collapse", "Seizures", "Severe paranoia",
                "Hallucinations", "Suicidal thoughts", "Threats of self-harm",
                "Violent agitation", "Prolonged periods without sleep",
              ].map((i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-red-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-300 shrink-0" />{i}
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <a href="tel:999" className="bg-white text-red-700 font-bold text-center py-4 px-5 rounded-2xl hover:bg-red-50 transition-colors text-lg">
                📞 999
              </a>
              <a href="tel:112" className="bg-white text-red-700 font-bold text-center py-4 px-5 rounded-2xl hover:bg-red-50 transition-colors text-lg">
                📞 112
              </a>
              <a href="tel:1800459459" className="bg-white text-red-700 font-bold text-center py-4 px-5 rounded-2xl hover:bg-red-50 transition-colors">
                <p className="text-base font-bold">HSE Helpline</p>
                <p className="text-red-600 text-sm">1800 459 459</p>
              </a>
            </div>
            <p className="text-red-100 text-sm mt-6 leading-relaxed">
              You can also attend your local emergency department or contact your GP / out-of-hours GP. You do not need a referral to seek emergency support.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq">
          <SectionHeader icon={CircleHelp} label="Common Questions" title="Frequently Asked Questions" color="teal" />
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

        {/* ── Final message ── */}
        <section>
          <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 text-center">
            <div className="max-w-2xl mx-auto">
              <Heart className="w-10 h-10 text-teal-400 mx-auto mb-6" />
              <h2 className="text-2xl md:text-3xl font-bold mb-5 leading-tight">
                Addiction is not the end of anyone's story.
              </h2>
              <p className="text-slate-300 leading-relaxed mb-6 text-lg">
                Support exists in Tallaght. Recovery pathways exist. Community support exists. People recover every day.
              </p>
              <p className="text-slate-300 leading-relaxed mb-8">
                Whether you are struggling yourself or worried about someone else, reaching out for help is not weakness. It is a step toward support, safety, stability, and recovery. Nobody has to face addiction alone.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="#services"
                  className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  Find local support <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="tel:1800459459"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  <Phone className="w-4 h-4" /> HSE Helpline: 1800 459 459
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sources ── */}
        <section className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">Sources & References</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { label: "Tallaght Rehabilitation Project", url: "https://www.tallaghtrehabproject.ie" },
              { label: "Tallaght Drug & Alcohol Task Force", url: "https://www.tallaghtdatf.ie" },
              { label: "HSE South West Dublin Drug & Alcohol Service", url: "https://www2.hse.ie/services/south-west-dublin-drug-and-alcohol-service/" },
              { label: "Drugs.ie — Cocaine Information", url: "https://www.drugs.ie/drugs_info/about_drugs/cocaine/" },
              { label: "Coolmine Therapeutic Community", url: "https://www.coolmine.ie" },
              { label: "NHS — Psychosis Information", url: "https://www.nhs.uk/mental-health/conditions/psychosis/" },
              { label: "NIDA / NIH — Cocaine Research", url: "https://nida.nih.gov/research-topics/cocaine" },
              { label: "PubMed / NIH Research Review", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6538444/" },
            ].map(({ label, url }) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 transition-colors"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                {label}
              </a>
            ))}
          </div>
        </section>

      </div>
    </>
  );
}

// ── Section header component ──────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  title,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  color: "teal" | "amber" | "green" | "red";
}) {
  const colors = {
    teal: { badge: "bg-teal-50 text-teal-700 border-teal-200", icon: "text-teal-600", bar: "bg-teal-500" },
    amber: { badge: "bg-amber-50 text-amber-700 border-amber-200", icon: "text-amber-600", bar: "bg-amber-500" },
    green: { badge: "bg-green-50 text-green-700 border-green-200", icon: "text-green-600", bar: "bg-green-500" },
    red: { badge: "bg-red-50 text-red-700 border-red-200", icon: "text-red-600", bar: "bg-red-500" },
  }[color];

  return (
    <div className="mb-8">
      <div className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border mb-4 ${colors.badge}`}>
        <Icon className={`w-3.5 h-3.5 ${colors.icon}`} />
        {label}
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-slate-800">{title}</h2>
      <div className={`w-12 h-1 mt-3 rounded-full ${colors.bar}`} />
    </div>
  );
}
