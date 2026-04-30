import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Search, MessageCircle, Phone, Globe, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const WHATSAPP_NUMBER = "353894366696";

const CATEGORIES = [
  "All",
  "Trades & Construction",
  "Food & Drink",
  "Health & Wellness",
  "Beauty & Hair",
  "Technology & IT",
  "Retail & Shopping",
  "Professional Services",
  "Childcare & Education",
  "Sport & Fitness",
  "Community & Charity",
  "Transport & Logistics",
  "Other",
];

const CATEGORY_ICONS: Record<string, string> = {
  "Trades & Construction": "🔨",
  "Food & Drink": "🍽️",
  "Health & Wellness": "💊",
  "Beauty & Hair": "💇",
  "Technology & IT": "💻",
  "Retail & Shopping": "🛍️",
  "Professional Services": "💼",
  "Childcare & Education": "🎓",
  "Sport & Fitness": "⚽",
  "Community & Charity": "🤝",
  "Transport & Logistics": "🚚",
  "Other": "🏪",
};

interface PublicBusiness {
  id: number;
  slug: string;
  name: string;
  ownerName: string | null;
  category: string;
  subcategory: string | null;
  description: string | null;
  phone: string | null;
  website: string | null;
  area: string | null;
  logoUrl: string | null;
  isFeatured: boolean;
  isSponsored: boolean;
  createdAt: string;
}

function BusinessCard({ b }: { b: PublicBusiness }) {
  const icon = CATEGORY_ICONS[b.category] ?? "🏪";
  return (
    <Link href={`/directory/${b.slug}`}>
      <div
        className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col ${
          b.isFeatured ? "border-yellow-300 shadow-sm" : "border-gray-200"
        }`}
      >
        {/* Logo / icon header */}
        <div className="relative">
          {b.logoUrl ? (
            <img src={b.logoUrl} alt={b.name} className="w-full h-36 object-cover" />
          ) : (
            <div className="w-full h-36 bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center text-5xl">
              {icon}
            </div>
          )}
          {b.isFeatured && (
            <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Star className="w-3 h-3" /> Featured
            </span>
          )}
        </div>

        <div className="p-4 flex flex-col flex-1">
          <div className="flex-1">
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">
              {icon} {b.subcategory ?? b.category}
            </p>
            <h3 className="font-semibold text-gray-900 leading-snug">{b.name}</h3>
            {b.area && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {b.area}
              </p>
            )}
            {b.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2 leading-snug">{b.description}</p>
            )}
          </div>

          <div className="flex gap-2 mt-3 flex-wrap">
            {b.phone && (
              <a
                href={`tel:${b.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full hover:bg-green-100 transition-colors"
              >
                <Phone className="w-3 h-3" /> Call
              </a>
            )}
            {b.website && (
              <a
                href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors"
              >
                <Globe className="w-3 h-3" /> Website
              </a>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function DirectoryPage() {
  const [businesses, setBusinesses] = useState<PublicBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (search) params.set("q", search);
    const qs = params.toString();
    fetch(`${BASE}/api/public/businesses${qs ? `?${qs}` : ""}`)
      .then((r) => r.ok ? r.json() as Promise<PublicBusiness[]> : [])
      .then(setBusinesses)
      .catch(() => setBusinesses([]))
      .finally(() => setLoading(false));
  }, [category, search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  const featured = businesses.filter((b) => b.isFeatured);
  const regular = businesses.filter((b) => !b.isFeatured);

  return (
    <>
      <Helmet>
        <title>Tallaght Business Directory — What's Up Tallaght</title>
        <meta name="description" content="Find local Tallaght businesses — trades, food, health, beauty, tech and more. Support local." />
      </Helmet>

      {/* Hero */}
      <div className="bg-zinc-800 text-white py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">🏪 Tallaght Business Directory</h1>
          <p className="text-white/70 text-lg mb-6">Support local — find Tallaght businesses near you</p>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search businesses…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
              />
            </div>
            <Button type="submit" className="bg-white text-zinc-800 hover:bg-white/90 rounded-xl px-5">
              Search
            </Button>
            {search && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setSearch(""); setSearchInput(""); }}
                className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl"
              >
                Clear
              </Button>
            )}
          </form>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                category === cat
                  ? "bg-zinc-800 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat !== "All" ? `${CATEGORY_ICONS[cat] ?? "🏪"} ` : ""}{cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-2xl h-64 animate-pulse" />
            ))}
          </div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🏪</p>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No businesses found</h2>
            <p className="text-gray-500 mb-6">
              {search ? `No results for "${search}"` : "Be the first to list your business!"}
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi! I'd like to list my business in the WUT directory.")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-[#25d366] hover:bg-[#20bd5a] text-white rounded-full">
                <MessageCircle className="w-4 h-4 mr-2" />
                List your business FREE
              </Button>
            </a>
          </div>
        ) : (
          <>
            {/* Featured businesses */}
            {featured.length > 0 && !search && category === "All" && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Featured Businesses</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {featured.map((b) => <BusinessCard key={b.id} b={b} />)}
                </div>
                <div className="border-t border-gray-200 my-8" />
              </div>
            )}

            {/* All / regular businesses */}
            {regular.length > 0 || (featured.length === 0) ? (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  {businesses.length} business{businesses.length !== 1 ? "es" : ""} listed
                  {category !== "All" ? ` in ${category}` : ""}
                  {search ? ` matching "${search}"` : ""}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {(search || category !== "All" ? businesses : regular).map((b) => (
                    <BusinessCard key={b.id} b={b} />
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}

        {/* CTA */}
        <div className="mt-16 bg-zinc-800 rounded-2xl px-8 py-10 text-center text-white">
          <h2 className="text-2xl font-bold mb-2">List your Tallaght business for FREE</h2>
          <p className="text-white/70 mb-6">
            Send us your business name, what you do, your contact details and a photo — and we'll create your listing and introduce you on Facebook.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi! I'd like to list my business in the WUT directory.\n\nBusiness name:\nWhat we do:\nPhone:\nWebsite:\nArea:")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="bg-[#25d366] hover:bg-[#20bd5a] text-white rounded-full text-base px-8 py-3 h-auto font-semibold">
              <MessageCircle className="w-5 h-5 mr-2" />
              WhatsApp us your details
            </Button>
          </a>
        </div>
      </div>
    </>
  );
}
