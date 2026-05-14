import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
  AlertTriangle,
  Phone,
  Brain,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  CircleHelp,
  Moon,
  Zap,
  TrendingDown,
  Heart,
  Eye,
} from "lucide-react";

const SECTIONS = [
  { id: "what-is-psychosis", label: "What Is Psychosis?" },
  { id: "paranoia", label: "Paranoia" },
  { id: "sleep", label: "Sleep & Mental Health" },
  { id: "brain-effects", label: "Brain Effects" },
  { id: "long-term", label: "Long-Term Effects" },
  { id: "crashes", label: "Emotional Crashes" },
  { id: "warning-signs", label: "Warning Signs" },
  { id: "urgent-help", label: "Urgent Help" },
  { id: "recovery", label: "Recovery" },
  { id: "faq", label: "FAQ" },
];

const FAQS = [
  {
    q: "Can cocaine cause psychosis?",
    a: "Yes. Heavy use, repeated binges, prolonged sleep deprivation, and escalating stimulant use can contribute to paranoia, hallucinations, and cocaine-related psychosis in some people.",
  },
  {
    q: "Can cocaine cause paranoia?",
    a: "Yes. Anxiety, fear, suspicion, overthinking, and paranoia are commonly reported effects linked to repeated cocaine use. These experiences can range from mild social anxiety to severe, disabling paranoia.",
  },
  {
    q: "Can cocaine affect the brain long-term?",
    a: "Research suggests repeated cocaine use may affect areas of the brain linked to reward, emotional regulation, impulse control, memory, and decision-making. However, recovery is possible — many people regain cognitive function over time with abstinence and support.",
  },
  {
    q: "Does lack of sleep make cocaine paranoia worse?",
    a: "Yes. Sleep deprivation significantly intensifies anxiety, paranoia, emotional instability, confusion, and psychological distress. This is one reason why binge use — which often involves long periods without sleep — carries particularly high mental health risks.",
  },
  {
    q: "Can people recover from cocaine addiction?",
    a: "Yes. Recovery is possible through support services, counselling, rehabilitation programmes, healthcare support, peer recovery, and community support. The brain and body can recover over time with proper sleep, abstinence, and structured support.",
  },
];

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
          <ChevronUp className="w-5 h-5 text-purple-600 shrink-0" />
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

function SectionHeader({
  icon: Icon,
  label,
  title,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  color: "purple" | "amber" | "red" | "green" | "blue";
}) {
  const colors = {
    purple: { badge: "bg-purple-50 text-purple-700 border-purple-200", icon: "text-purple-600", bar: "bg-purple-500" },
    amber: { badge: "bg-amber-50 text-amber-700 border-amber-200", icon: "text-amber-600", bar: "bg-amber-500" },
    red: { badge: "bg-red-50 text-red-700 border-red-200", icon: "text-red-600", bar: "bg-red-500" },
    green: { badge: "bg-green-50 text-green-700 border-green-200", icon: "text-green-600", bar: "bg-green-500" },
    blue: { badge: "bg-blue-50 text-blue-700 border-blue-200", icon: "text-blue-600", bar: "bg-blue-500" },
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

export default function CocainePsychosisBrainEffectsPage() {
  return (
    <>
      <Helmet>
        <title>Cocaine Psychosis & Brain Effects | What's Up Tallaght</title>
        <meta
          name="description"
          content="Understanding cocaine psychosis, paranoia, sleep deprivation, and long-term brain effects. Awareness, warning signs, and support resources for Tallaght."
        />
      </Helmet>

      {/* Crisis banner */}
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

      {/* Hero */}
      <section className="bg-slate-900 text-white py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-4xl">
          <Link
            href="/cocaine-support-tallaght"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm font-medium mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Cocaine Support Tallaght
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-purple-500/20 text-purple-300 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border border-purple-500/30">
              Supporting Resource
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-6">
            Cocaine Psychosis<br />
            <span className="text-purple-400">& Brain Effects</span>
          </h1>
          <p className="text-slate-300 text-lg md:text-xl leading-relaxed mb-8 max-w-3xl">
            Many people associate cocaine with confidence, energy, and social situations. What is discussed far less often is the effect cocaine can have on mental health, sleep, anxiety, paranoia, emotional wellbeing, and the brain itself.
          </p>
          <p className="text-slate-400 leading-relaxed mb-8 max-w-3xl">
            This page is not intended to shame or frighten people. The goal is awareness, understanding, and helping people recognise risks early — before things reach crisis point.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: Brain, label: "Understanding the brain effects" },
              { icon: Eye, label: "Recognising warning signs" },
              { icon: Heart, label: "Support & recovery exist" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <Icon className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="text-white/90 text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Anchor nav */}
      <nav className="sticky top-16 z-40 bg-white border-b border-slate-200 shadow-sm overflow-x-auto">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 py-2 min-w-max">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs font-medium text-slate-600 hover:text-purple-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 max-w-4xl py-12 space-y-20">

        {/* What is cocaine psychosis */}
        <section id="what-is-psychosis">
          <SectionHeader icon={Brain} label="Understanding Psychosis" title="What Is Cocaine Psychosis?" color="purple" />
          <p className="text-slate-700 leading-relaxed mb-6">
            Cocaine psychosis is a term used to describe severe psychological symptoms that can occur during or after cocaine use. Psychosis means a person may temporarily lose touch with reality — and these experiences can feel completely real to the person going through them.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4">Psychosis can include:</h3>
              <ul className="space-y-2">
                {[
                  "Hallucinations",
                  "Hearing voices",
                  "Seeing things that are not there",
                  "Severe paranoia",
                  "Irrational beliefs",
                  "Confusion",
                  "Extreme fear or agitation",
                  "Believing people are trying to harm them",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5" />{i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6">
              <h3 className="font-bold text-purple-900 mb-4">More likely to occur during:</h3>
              <ul className="space-y-2">
                {[
                  "Heavy cocaine use",
                  "Repeated binge use",
                  "Prolonged periods without sleep",
                  "Mixing cocaine with other substances",
                  "Long-term stimulant use",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-purple-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0 mt-1.5" />{i}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4">
            <p className="text-slate-600 text-sm leading-relaxed">
              <strong>Important:</strong> Not everyone who uses cocaine will experience psychosis. However, repeated and escalating use can increase the risk significantly over time.
            </p>
          </div>
        </section>

        {/* Paranoia */}
        <section id="paranoia">
          <SectionHeader icon={Eye} label="Psychological Effects" title="What Does Cocaine Paranoia Feel Like?" color="amber" />
          <p className="text-slate-700 leading-relaxed mb-8">
            Paranoia is one of the most commonly reported psychological effects linked to repeated cocaine use. For some people it begins subtly — and can gradually intensify over time, particularly when combined with sleep deprivation.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4">People may experience:</h3>
              <ul className="space-y-2">
                {[
                  "Racing thoughts",
                  "Suspicion and fear",
                  "Feeling watched",
                  "Believing people are talking about them",
                  "Intense social anxiety",
                  "Inability to trust people",
                  "Panic in social situations",
                  "Hyper-alertness",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />{i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <h3 className="font-bold text-amber-900 mb-3">How it can escalate</h3>
              <p className="text-amber-800 text-sm leading-relaxed mb-4">What starts as manageable anxiety can develop into:</p>
              <ul className="space-y-2">
                {[
                  "Checking phones repeatedly",
                  "Believing friends are against them",
                  "Feeling unsafe in public",
                  "Avoiding people entirely",
                  "Obsessively overthinking conversations",
                  "Feeling mentally exhausted after weekends",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />{i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Sleep deprivation */}
        <section id="sleep">
          <SectionHeader icon={Moon} label="Sleep & Wellbeing" title="Cocaine, Sleep Deprivation & Mental Health" color="blue" />
          <p className="text-slate-700 leading-relaxed mb-8">
            Sleep deprivation plays a major role in cocaine-related mental health problems. Cocaine is a stimulant — it can keep people awake for long periods and leave the nervous system overstimulated. The consequences for mental health can be severe.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
            <h3 className="font-bold text-blue-900 mb-4">Long periods without proper sleep can intensify:</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                "Anxiety", "Paranoia", "Emotional instability", "Panic attacks",
                "Confusion", "Agitation", "Impulsive behaviour", "Emotional crashes",
              ].map((i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-blue-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />{i}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-6">
            <p className="font-semibold text-lg mb-3 text-white">The danger combination</p>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Even people who initially feel "fine" during cocaine use may experience severe emotional crashes once the stimulant effects wear off. The combination of:
            </p>
            <div className="flex flex-wrap gap-2">
              {["Stimulant use", "Emotional stress", "Alcohol", "Exhaustion", "Lack of sleep"].map((i) => (
                <span key={i} className="bg-white/10 border border-white/20 text-white text-sm px-3 py-1.5 rounded-full">{i}</span>
              ))}
            </div>
            <p className="text-slate-400 text-sm mt-4">
              ...can place enormous pressure on mental wellbeing — and significantly increase the risk of paranoia, psychosis, and emotional crisis.
            </p>
          </div>
        </section>

        {/* How cocaine affects the brain */}
        <section id="brain-effects">
          <SectionHeader icon={Zap} label="Neuroscience" title="How Cocaine Affects the Brain" color="purple" />
          <p className="text-slate-700 leading-relaxed mb-8">
            Cocaine directly affects brain chemicals involved in how we feel pleasure, manage stress, stay motivated, and regulate our emotions. Understanding this helps explain why addiction can be so difficult to break — and why it is not simply a matter of willpower.
          </p>

          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 mb-8">
            <h3 className="font-bold text-purple-900 mb-2">The role of dopamine</h3>
            <p className="text-purple-800 text-sm leading-relaxed mb-4">
              One of the main brain chemicals involved is dopamine — which plays a key role in pleasure, motivation, reward, learning, and habit formation. Cocaine causes large increases in dopamine activity, temporarily creating feelings of confidence, alertness, energy, and euphoria.
            </p>
            <p className="text-purple-800 text-sm leading-relaxed">
              However, repeated cocaine exposure can affect how the brain processes reward, stress, impulse control, emotional regulation, and motivation — making it increasingly difficult to relax naturally or feel pleasure without cocaine.
            </p>
          </div>

          <div className="bg-slate-50 border-l-4 border-purple-500 rounded-r-xl px-6 py-5">
            <p className="text-slate-700 leading-relaxed text-sm">
              <strong>This is one reason addiction can become much harder to break than simply "choosing to stop."</strong> The brain itself has been changed by repeated exposure — and that change requires time, support, and structured recovery to address.
            </p>
          </div>
        </section>

        {/* Long-term effects */}
        <section id="long-term">
          <SectionHeader icon={TrendingDown} label="Research Findings" title="Long-Term Brain & Cognitive Effects" color="amber" />
          <p className="text-slate-700 leading-relaxed mb-8">
            Research into cocaine use disorder has linked repeated cocaine exposure with a range of cognitive and emotional difficulties. It is important to note this does not mean everyone who uses cocaine will experience permanent damage — but the risks are real and increase with frequency of use.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4">Possible cognitive difficulties:</h3>
              <ul className="space-y-2">
                {[
                  "Concentration & attention",
                  "Memory",
                  "Emotional regulation",
                  "Impulse control",
                  "Planning ahead",
                  "Decision-making",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />{i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <h3 className="font-bold text-amber-900 mb-4">How people describe it:</h3>
              <ul className="space-y-2">
                {[
                  "Mentally foggy",
                  "Emotionally numb",
                  "Unable to focus properly",
                  "Constantly overwhelmed",
                  "Emotionally unstable",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />{i}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
            <p className="text-green-900 text-sm leading-relaxed">
              <strong>Recovery is possible.</strong> Research suggests the brain and body can recover over time with abstinence, proper sleep, counselling, and structured support. Long-term effects are not inevitable — and many people rebuild cognitive and emotional functioning through recovery.
            </p>
          </div>
        </section>

        {/* Emotional crashes */}
        <section id="crashes">
          <SectionHeader icon={TrendingDown} label="After Use" title="Emotional Crashes After Cocaine Use" color="blue" />
          <p className="text-slate-700 leading-relaxed mb-8">
            Many people describe severe emotional crashes after cocaine use. These crashes are not just "feeling tired" — they can involve significant psychological distress that may last for days.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4">Crashes may involve:</h3>
              <ul className="space-y-2">
                {[
                  "Depression",
                  "Hopelessness",
                  "Guilt and shame",
                  "Exhaustion",
                  "Emotional numbness",
                  "Anxiety and panic",
                  "Irritability",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />{i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h3 className="font-bold text-blue-900 mb-4">The dangerous cycle</h3>
              <div className="space-y-3">
                {[
                  { step: "1", text: "The crash increases emotional distress" },
                  { step: "2", text: "Cocaine is used again to escape the crash" },
                  { step: "3", text: "Dependence gradually develops" },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{step}</span>
                    <p className="text-blue-800 text-sm leading-relaxed pt-0.5">{text}</p>
                  </div>
                ))}
              </div>
              <p className="text-blue-800 text-sm mt-4 leading-relaxed">What begins as occasional use can slowly become emotional reliance.</p>
            </div>
          </div>
        </section>

        {/* Warning signs */}
        <section id="warning-signs">
          <SectionHeader icon={AlertTriangle} label="Recognising Difficulty" title="Warning Signs That Someone May Need Help" color="amber" />
          <p className="text-slate-700 leading-relaxed mb-6">
            No single symptom proves cocaine addiction or psychosis. But repeated patterns of distress, paranoia, emotional instability, sleep deprivation, or psychological decline may indicate someone needs support.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
              {[
                "Severe anxiety",
                "Paranoia",
                "Panic attacks",
                "Emotional instability",
                "Repeated binges",
                "Staying awake all night",
                "Hearing voices",
                "Hallucinations",
                "Chest pain",
                "Emotional crashes",
                "Aggression",
                "Isolation",
                "Suicidal thoughts",
                "Increasing secrecy",
                "Emotional exhaustion",
              ].map((i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-900">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />{i}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Urgent help */}
        <section id="urgent-help">
          <div className="bg-red-600 text-white rounded-3xl p-8 md:p-10">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-white/20 rounded-2xl p-3 shrink-0">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <p className="text-red-100 text-sm font-semibold uppercase tracking-widest mb-1">Emergency & Crisis</p>
                <h2 className="text-2xl md:text-3xl font-bold">When Urgent Help May Be Needed</h2>
              </div>
            </div>
            <p className="text-red-100 text-sm mb-6 leading-relaxed">
              Seek urgent support immediately if someone is experiencing any of the following:
            </p>
            <div className="grid sm:grid-cols-2 gap-2 mb-8">
              {[
                "Hallucinations",
                "Severe paranoia",
                "Violent agitation",
                "Suicidal thoughts",
                "Collapse",
                "Seizures",
                "Chest pain",
                "Threats of self-harm",
                "Prolonged periods without sleep",
                "Inability to distinguish reality",
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
            <p className="text-red-100 text-sm mt-5 leading-relaxed">
              You can also attend your local emergency department or contact your GP / out-of-hours GP without a referral.
            </p>
          </div>
        </section>

        {/* Recovery */}
        <section id="recovery">
          <SectionHeader icon={Heart} label="Hope & Recovery" title="Recovery Is Possible" color="green" />
          <p className="text-slate-700 leading-relaxed mb-8">
            The message here is not that people are permanently damaged. The message is that cocaine can seriously affect mental health and the brain — and getting support early matters. The brain and body can recover over time.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[
              { title: "Abstinence & Sleep", desc: "Proper sleep and abstinence from stimulants allow the nervous system to begin recovering." },
              { title: "Counselling", desc: "One-to-one professional support addressing addiction, anxiety, and the psychological impact of cocaine use." },
              { title: "Rehabilitation", desc: "Structured programmes supporting people through recovery with routine, structure, and stability." },
              { title: "Mental Health Support", desc: "Addressing anxiety, paranoia, depression, and the psychological effects that accompany cocaine use." },
              { title: "Peer Recovery", desc: "Connecting with others who understand — reducing isolation and building community connection." },
              { title: "Medical Support", desc: "GP and healthcare support to address physical health, sleep, and referrals to specialist services." },
            ].map(({ title, desc }) => (
              <div key={title} className="bg-green-50 border border-green-200 rounded-2xl p-5">
                <p className="font-semibold text-green-900 mb-2">{title}</p>
                <p className="text-green-800 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <p className="font-semibold text-slate-800 mb-3">Many people recover and rebuild:</p>
            <div className="flex flex-wrap gap-2">
              {["Mental wellbeing", "Emotional stability", "Family relationships", "Confidence", "Daily routine", "Quality of life"].map((i) => (
                <span key={i} className="bg-green-100 text-green-800 border border-green-200 text-sm px-3 py-1.5 rounded-full font-medium">{i}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Services */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Support Services in Tallaght & Ireland</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { name: "Tallaght Rehabilitation Project (TRP)", desc: "Community-based rehabilitation and recovery support service in Tallaght.", url: "https://www.tallaghtrehabproject.ie", highlight: true },
              { name: "Tallaght Drug & Alcohol Task Force (TDATF)", desc: "Community addiction-response and support coordination service.", url: "https://www.tallaghtdatf.ie", highlight: true },
              { name: "HSE South West Dublin Drug and Alcohol Service", desc: "Assessment, support, and addiction treatment pathways.", url: "https://www2.hse.ie/services/south-west-dublin-drug-and-alcohol-service/", highlight: false },
              { name: "Cocaine Anonymous Ireland", desc: "Free peer-support recovery meetings.", url: "https://www.ca-ireland.org", highlight: false },
              { name: "Narcotics Anonymous Ireland", desc: "Free anonymous peer-support recovery meetings.", url: "https://www.na-ireland.org", highlight: false },
              { name: "Drugs.ie", desc: "Information and support resources.", url: "https://www.drugs.ie", highlight: false },
            ].map((s) => (
              <div key={s.name} className={`rounded-2xl border p-5 flex flex-col gap-3 ${s.highlight ? "bg-purple-50 border-purple-200" : "bg-white border-slate-200"}`}>
                <div>
                  <h3 className={`font-bold text-base ${s.highlight ? "text-purple-900" : "text-slate-800"}`}>{s.name}</h3>
                  <p className={`text-sm mt-1 leading-relaxed ${s.highlight ? "text-purple-700" : "text-slate-500"}`}>{s.desc}</p>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors ${s.highlight ? "text-purple-700 hover:text-purple-900" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Visit website <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq">
          <SectionHeader icon={CircleHelp} label="Common Questions" title="Frequently Asked Questions" color="purple" />
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

        {/* Final message */}
        <section>
          <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 text-center">
            <div className="max-w-2xl mx-auto">
              <Brain className="w-10 h-10 text-purple-400 mx-auto mb-6" />
              <h2 className="text-2xl md:text-3xl font-bold mb-5 leading-tight">
                The effects can build gradually over time.
              </h2>
              <p className="text-slate-300 leading-relaxed mb-6 text-lg">
                Many people do not realise how much cocaine is affecting their mental wellbeing until anxiety, paranoia, emotional crashes, or psychological distress begin interfering with daily life.
              </p>
              <p className="text-slate-300 leading-relaxed mb-8">
                The most important thing is recognising that support exists before things reach crisis point. People recover. Support exists. Nobody has to face addiction alone.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/cocaine-support-tallaght"
                  className="inline-flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Full support & services guide
                </Link>
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

        {/* Sources */}
        <section className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">Sources & References</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { label: "NIDA / NIH — Cocaine Research", url: "https://nida.nih.gov/research-topics/cocaine" },
              { label: "NHS — Psychosis Information", url: "https://www.nhs.uk/mental-health/conditions/psychosis/" },
              { label: "Drugs.ie — Cocaine Information", url: "https://www.drugs.ie/drugs_info/about_drugs/cocaine/" },
              { label: "PubMed / NIH Research Review", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6538444/" },
              { label: "HSE South West Dublin Drug & Alcohol Service", url: "https://www2.hse.ie/services/south-west-dublin-drug-and-alcohol-service/" },
              { label: "Tallaght Rehabilitation Project", url: "https://www.tallaghtrehabproject.ie" },
              { label: "Tallaght Drug & Alcohol Task Force", url: "https://www.tallaghtdatf.ie" },
            ].map(({ label, url }) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-purple-600 transition-colors">
                <ExternalLink className="w-3 h-3 shrink-0" />{label}
              </a>
            ))}
          </div>
        </section>

      </div>
    </>
  );
}
