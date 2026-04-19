import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArticleCard } from "@/components/article-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, MapPin, Phone, Globe, Clock, Navigation, ChevronRight } from "lucide-react";
import { WhatsAppLoopCTA } from "@/components/whatsapp-loop-cta";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const TYPE_LABELS: Record<string, string> = {
  sports_club: "Sports Club",
  venue: "Venue",
  place: "Place",
  business: "Business",
  organisation: "Organisation",
  event_series: "Event Series",
};

const TYPE_COLORS: Record<string, string> = {
  sports_club: "bg-green-100 text-green-700 border-green-200",
  venue: "bg-amber-100 text-amber-700 border-amber-200",
  place: "bg-sky-100 text-sky-700 border-sky-200",
  business: "bg-violet-100 text-violet-700 border-violet-200",
  organisation: "bg-blue-100 text-blue-700 border-blue-200",
  event_series: "bg-rose-100 text-rose-700 border-rose-200",
};

const SCHEMA_TYPES: Record<string, string> = {
  sports_club: "SportsOrganization",
  venue: "SportsActivityLocation",
  place: "CivicStructure",
  business: "LocalBusiness",
  organisation: "Organization",
  event_series: "Organization",
};

interface LinkedArticle {
  postId: number;
  title: string;
  slug: string;
  excerpt: string | null;
  headerImageUrl: string | null;
  primaryCategoryId: number | null;
  publishedAt: string | null;
}

interface RelatedPage {
  id: number;
  name: string;
  slug: string;
  entityType: string;
  shortDescription: string | null;
  photos: string[];
  relationLabel: string | null;
}

interface EntityPageData {
  id: number;
  name: string;
  slug: string;
  entityType: string;
  aliases: string[];
  shortDescription: string | null;
  generatedBody: string | null;
  address: string | null;
  directions: string | null;
  website: string | null;
  phone: string | null;
  openingHours: string | null;
  photos: string[];
  aiContext: Record<string, string> | null;
  seoTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
  linkedArticles: LinkedArticle[];
  relatedPages: RelatedPage[];
}

async function fetchEntityPage(slug: string): Promise<EntityPageData> {
  const res = await fetch(`${BASE_URL}/api/public/entity-pages/${slug}`);
  if (res.status === 404) throw new Error("not_found");
  if (!res.ok) throw new Error("fetch_error");
  return res.json();
}

export default function PlacePage() {
  const [, params] = useRoute("/place/:slug");
  const slug = params?.slug ?? "";

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["entity-page-public", slug],
    queryFn: () => fetchEntityPage(slug),
    enabled: !!slug,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <Skeleton className="h-10 w-2/3 mb-4" />
        <Skeleton className="h-6 w-1/3 mb-8" />
        <Skeleton className="w-full h-64 rounded-xl mb-8" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    );
  }

  if (error || !page) {
    const isNotFound = (error as Error)?.message === "not_found";
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{isNotFound ? "Page Not Found" : "Error"}</AlertTitle>
          <AlertDescription>
            {isNotFound
              ? "This place page doesn't exist or hasn't been published yet."
              : "Failed to load this page. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const canonicalUrl = `https://whatsuptallaght.ie/place/${page.slug}`;
  const seoTitle = page.seoTitle || `${page.name} | What's Up Tallaght`;
  const metaDesc =
    page.metaDescription ||
    page.shortDescription ||
    `Learn about ${page.name} in Tallaght, Dublin on What's Up Tallaght.`;

  const heroPhoto = page.photos?.[0] ?? null;

  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPES[page.entityType] ?? "Organization",
    name: page.name,
    description: metaDesc,
    url: canonicalUrl,
    ...(page.address ? { address: { "@type": "PostalAddress", streetAddress: page.address } } : {}),
    ...(page.phone ? { telephone: page.phone } : {}),
    ...(page.website ? { sameAs: [page.website] } : {}),
    ...(heroPhoto ? { image: heroPhoto } : {}),
  };

  const hasContactInfo = page.address || page.phone || page.website || page.openingHours || page.directions;

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="place" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={metaDesc} />
        {heroPhoto && <meta property="og:image" content={heroPhoto} />}
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="What's Up Tallaght" />
        <meta name="twitter:card" content={heroPhoto ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={metaDesc} />
        {heroPhoto && <meta name="twitter:image" content={heroPhoto} />}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <article className="w-full pb-20 bg-white">
        {/* Hero — photo if available, otherwise a clean colour strip */}
        {heroPhoto ? (
          <div className="w-full overflow-hidden bg-black relative" style={{ aspectRatio: "21/7" }}>
            <img
              src={heroPhoto}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-50 pointer-events-none select-none"
            />
            <img
              src={heroPhoto}
              alt={page.name}
              className="relative w-full h-full object-contain object-center z-10"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent z-20" />
            <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 z-30">
              <div className="container mx-auto max-w-4xl">
                <Badge
                  className={`mb-4 text-sm px-3 py-1 font-semibold border ${TYPE_COLORS[page.entityType] ?? ""}`}
                  variant="outline"
                >
                  {TYPE_LABELS[page.entityType] ?? page.entityType}
                </Badge>
                <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight drop-shadow-md">
                  {page.name}
                </h1>
                {page.shortDescription && (
                  <p className="mt-2 text-white/80 text-base md:text-lg max-w-2xl">
                    {page.shortDescription}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full bg-primary/5 border-b border-border py-10 px-4">
            <div className="container mx-auto max-w-4xl">
              <Badge
                className={`mb-4 text-sm px-3 py-1 font-semibold border ${TYPE_COLORS[page.entityType] ?? ""}`}
                variant="outline"
              >
                {TYPE_LABELS[page.entityType] ?? page.entityType}
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                {page.name}
              </h1>
              {page.shortDescription && (
                <p className="mt-2 text-muted-foreground text-base max-w-2xl">
                  {page.shortDescription}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="container mx-auto px-4 max-w-4xl mt-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-8">
            <Link href="/">
              <a className="hover:text-foreground transition-colors">Home</a>
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-foreground font-medium">{page.name}</span>
          </nav>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="md:col-span-2">
              {page.generatedBody ? (
                <div className="prose prose-sm sm:prose max-w-none text-foreground
                  prose-headings:font-bold prose-headings:text-foreground
                  prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
                  prose-p:text-foreground/90 prose-p:leading-relaxed
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                  <ReactMarkdown>{page.generatedBody}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground italic">
                  More information about {page.name} coming soon.
                </p>
              )}

              {/* Additional photos (skip first — already used as hero) */}
              {page.photos && page.photos.length > 1 && (
                <div className="mt-10">
                  <h2 className="text-lg font-bold text-foreground mb-4">Photos</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {page.photos.slice(1).map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`${page.name} photo ${i + 2}`}
                        className="w-full aspect-square object-cover rounded-lg border border-border"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Contact sidebar */}
            {hasContactInfo && (
              <aside className="md:col-span-1">
                <div className="bg-muted/40 border border-border rounded-xl p-5 sticky top-6">
                  <h2 className="font-bold text-foreground text-base mb-4">Visit &amp; Contact</h2>
                  <div className="space-y-4 text-sm">
                    {page.address && (
                      <div className="flex gap-3">
                        <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <p className="text-foreground/90 whitespace-pre-line">{page.address}</p>
                      </div>
                    )}
                    {page.directions && (
                      <div className="flex gap-3">
                        <Navigation className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <p className="text-foreground/90">{page.directions}</p>
                      </div>
                    )}
                    {page.openingHours && (
                      <div className="flex gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <p className="text-foreground/90">{page.openingHours}</p>
                      </div>
                    )}
                    {page.phone && (
                      <div className="flex gap-3">
                        <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <a href={`tel:${page.phone}`} className="text-primary hover:underline">
                          {page.phone}
                        </a>
                      </div>
                    )}
                    {page.website && (
                      <div className="flex gap-3">
                        <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <a
                          href={page.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline break-all"
                        >
                          {page.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </div>

          {/* Recent Coverage */}
          {page.linkedArticles && page.linkedArticles.length > 0 && (
            <section className="mt-14">
              <h2 className="text-2xl font-bold text-foreground mb-6">
                Recent Coverage
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {page.linkedArticles.map((article) => (
                  <ArticleCard
                    key={article.postId}
                    post={{
                      id: article.postId,
                      title: article.title,
                      slug: article.slug,
                      excerpt: article.excerpt,
                      headerImageUrl: article.headerImageUrl,
                      primaryCategoryId: article.primaryCategoryId,
                      publishedAt: article.publishedAt,
                      status: "published",
                    } as any}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Related Places */}
          {page.relatedPages && page.relatedPages.length > 0 && (
            <section className="mt-14">
              <h2 className="text-2xl font-bold text-foreground mb-6">Related Places</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {page.relatedPages.map((rp) => (
                  <Link key={rp.id} href={`/place/${rp.slug}`}>
                    <a className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all">
                      {rp.photos?.[0] ? (
                        <img
                          src={rp.photos[0]}
                          alt={rp.name}
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-border"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center">
                          <span className="text-xl">📍</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                          {rp.name}
                        </p>
                        {rp.relationLabel && (
                          <p className="text-xs text-muted-foreground mt-0.5">{rp.relationLabel}</p>
                        )}
                        {rp.shortDescription && !rp.relationLabel && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{rp.shortDescription}</p>
                        )}
                        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium border ${TYPE_COLORS[rp.entityType] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {TYPE_LABELS[rp.entityType] ?? rp.entityType}
                        </span>
                      </div>
                    </a>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* WhatsApp CTA */}
          <div className="mt-14">
            <WhatsAppLoopCTA />
          </div>
        </div>
      </article>
    </>
  );
}
