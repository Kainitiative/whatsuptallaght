import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Phone, Globe, MapPin, Mail, ArrowLeft, MessageCircle, Share2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const WHATSAPP_NUMBER = "353894366696";

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
  email: string | null;
  website: string | null;
  address: string | null;
  area: string | null;
  logoUrl: string | null;
  isFeatured: boolean;
  createdAt: string;
}

interface Props {
  params: { slug: string };
}

export default function BusinessProfilePage({ params }: Props) {
  const { slug } = params;
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`${BASE}/api/public/businesses/${slug}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json() as Promise<PublicBusiness>;
      })
      .then((data) => { if (data) setBusiness(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: business?.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-gray-200 rounded-2xl" />
          <div className="h-8 bg-gray-200 rounded w-2/3 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl mb-4">🏪</p>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Business not found</h1>
        <p className="text-gray-500 mb-6">This listing may have expired or been removed.</p>
        <Link href="/directory">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
          </Button>
        </Link>
      </div>
    );
  }

  const icon = CATEGORY_ICONS[business.category] ?? "🏪";
  const websiteUrl = business.website
    ? (business.website.startsWith("http") ? business.website : `https://${business.website}`)
    : null;

  return (
    <>
      <Helmet>
        <title>{business.name} — Tallaght Business Directory | What's Up Tallaght</title>
        <meta
          name="description"
          content={business.description ?? `${business.name} — ${business.category} in Tallaght, Dublin. Find contact details and more on the WUT Business Directory.`}
        />
        {business.logoUrl && <meta property="og:image" content={`${BASE}${business.logoUrl}`} />}
      </Helmet>

      <div className="container mx-auto max-w-2xl px-4 py-8">
        {/* Back link */}
        <Link href="/directory" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Directory
        </Link>

        {/* Business card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Header image */}
          {business.logoUrl ? (
            <img
              src={business.logoUrl}
              alt={business.name}
              className="w-full h-56 object-cover"
            />
          ) : (
            <div className="w-full h-56 bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center text-7xl">
              {icon}
            </div>
          )}

          <div className="p-6">
            {/* Category + Featured badge */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                {icon} {business.subcategory ?? business.category}
              </span>
              {business.isFeatured && (
                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" /> Featured
                </span>
              )}
            </div>

            {/* Name */}
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{business.name}</h1>

            {/* Owner + Area */}
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4 flex-wrap">
              {business.ownerName && <span>{business.ownerName}</span>}
              {business.area && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {business.area}
                </span>
              )}
            </div>

            {/* Description */}
            {business.description && (
              <p className="text-gray-700 leading-relaxed mb-6">{business.description}</p>
            )}

            {/* Contact info */}
            <div className="space-y-3 mb-6">
              {business.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className="flex items-center gap-3 p-3.5 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors group"
                >
                  <Phone className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Phone</p>
                    <p className="text-green-800 font-semibold">{business.phone}</p>
                  </div>
                </a>
              )}
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  <Globe className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Website</p>
                    <p className="text-blue-800 font-semibold truncate">{business.website}</p>
                  </div>
                </a>
              )}
              {business.email && (
                <a
                  href={`mailto:${business.email}`}
                  className="flex items-center gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <Mail className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Email</p>
                    <p className="text-gray-800 font-semibold">{business.email}</p>
                  </div>
                </a>
              )}
              {business.address && (
                <div className="flex items-center gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <MapPin className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Address</p>
                    <p className="text-gray-800 font-semibold">{business.address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Share button */}
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              {shared ? "Link copied!" : "Share this business"}
            </button>
          </div>
        </div>

        {/* Listed date */}
        <p className="text-xs text-gray-400 text-center mt-4">
          Listed on the WUT Business Directory · {new Date(business.createdAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        {/* Is this your business CTA */}
        <div className="mt-6 bg-zinc-50 border border-gray-200 rounded-2xl px-6 py-5 text-center">
          <p className="text-sm font-medium text-gray-700 mb-3">Is this your business? Update your details via WhatsApp.</p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi! I'd like to update the listing for ${business.name} in the WUT directory.`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" className="bg-[#25d366] hover:bg-[#20bd5a] text-white rounded-full">
              <MessageCircle className="w-4 h-4 mr-1.5" /> Update my listing
            </Button>
          </a>
        </div>
      </div>
    </>
  );
}
