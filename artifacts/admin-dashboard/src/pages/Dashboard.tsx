import { useEffect, useState } from "react";
import { Link } from "wouter";
import { getStats } from "@/lib/api";

interface Stats {
  totalPublished: number;
  totalDraft: number;
  totalHeld: number;
  todayPublished: number;
}

const STAT_CARDS = [
  { key: "todayPublished", label: "Published Today", icon: "📰", colour: "bg-blue-50 border-blue-200", textColour: "text-blue-700" },
  { key: "totalHeld", label: "Awaiting Review", icon: "🔶", colour: "bg-amber-50 border-amber-200", textColour: "text-amber-700", link: "/review" },
  { key: "totalPublished", label: "Total Published", icon: "✅", colour: "bg-green-50 border-green-200", textColour: "text-green-700", link: "/articles?status=published" },
  { key: "totalDraft", label: "Drafts", icon: "📝", colour: "bg-gray-50 border-gray-200", textColour: "text-gray-700" },
] as const;

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats().then(setStats).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of the Tallaght Community Hub</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {STAT_CARDS.map((card) => {
          const value = stats?.[card.key] ?? 0;
          const inner = (
            <div className={`border rounded-xl p-5 ${card.colour} flex flex-col gap-2 h-full`}>
              <div className="text-2xl">{card.icon}</div>
              <div className={`text-3xl font-bold ${card.textColour}`}>
                {loading ? "—" : value}
              </div>
              <div className="text-sm font-medium text-gray-600">{card.label}</div>
            </div>
          );
          return card.link ? (
            <Link key={card.key} href={card.link}><a className="block hover:scale-[1.01] transition-transform">{inner}</a></Link>
          ) : (
            <div key={card.key}>{inner}</div>
          );
        })}
      </div>

      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/review">
            <a className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
              <span className="text-xl">🔶</span>
              <div>
                <p className="text-sm font-medium text-amber-900">Review Queue</p>
                <p className="text-xs text-amber-700">Approve or reject held articles</p>
              </div>
            </a>
          </Link>
          <Link href="/golden">
            <a className="flex items-center gap-3 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors">
              <span className="text-xl">⭐</span>
              <div>
                <p className="text-sm font-medium text-yellow-900">Golden Examples</p>
                <p className="text-xs text-yellow-700">Train the AI with great articles</p>
              </div>
            </a>
          </Link>
          <Link href="/settings">
            <a className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-xl">⚙️</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Settings</p>
                <p className="text-xs text-gray-600">Configure API keys & integrations</p>
              </div>
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
