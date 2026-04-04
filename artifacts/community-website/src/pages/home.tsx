import { useState } from "react";
import { Link } from "wouter";
import { useListPosts, getListPostsQueryKey, useListCategories, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { ArticleCard } from "@/components/article-card";
import { CategoryFilter } from "@/components/category-filter";
import { WhatsAppSubmit } from "@/components/whatsapp-submit";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, AlertCircle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Home() {
  const [page, setPage] = useState(1);
  const limit = 9;

  const { data: postsData, isLoading: isLoadingPosts, error: postsError } = useListPosts({
    status: "published",
    page,
    limit,
  }, {
    query: {
      queryKey: getListPostsQueryKey({ status: "published", page, limit }),
    }
  });

  const { data: featuredPostsData, isLoading: isLoadingFeatured } = useListPosts({
    status: "published",
    featured: true,
    limit: 1,
  }, {
    query: {
      queryKey: getListPostsQueryKey({ status: "published", featured: true, limit: 1 }),
    }
  });

  // Extra pool used to find the best hero image (WhatsApp photo priority)
  const { data: heroCandidatesData } = useListPosts({
    status: "published",
    limit: 15,
  }, {
    query: {
      queryKey: getListPostsQueryKey({ status: "published", limit: 15 }),
    }
  });

  const { data: categories } = useListCategories({
    query: {
      queryKey: getListCategoriesQueryKey(),
    }
  });

  const eventsCategory = categories?.find(c => c.name.toLowerCase().includes("event") || c.name.toLowerCase().includes("what's on"));
  const weekendGuideCategory = categories?.find(c => c.slug === "weekend-guide");

  const { data: weekendGuideData } = useListPosts({
    status: "published",
    categorySlug: "weekend-guide",
    limit: 1,
  }, {
    query: {
      queryKey: getListPostsQueryKey({ status: "published", categorySlug: "weekend-guide", limit: 1 }),
    }
  });

  const weekendGuidePost = weekendGuideData?.posts?.[0];
  
  const { data: eventPostsData } = useListPosts({
    status: "published",
    categorySlug: eventsCategory?.slug,
    limit: 3,
  }, {
    query: {
      enabled: !!eventsCategory,
      queryKey: getListPostsQueryKey({ status: "published", categorySlug: eventsCategory?.slug, limit: 3 }),
    }
  });

  const getCategoryInfo = (categoryId: number | null | undefined) => {
    if (!categoryId || !categories) return { name: "News", slug: "news", color: "" };
    const category = categories.find(c => c.id === categoryId);
    return category ? { name: category.name, slug: category.slug, color: category.color } : { name: "News", slug: "news", color: "" };
  };

  // Hero selection: admin-featured → WhatsApp photo → any-image → any post
  const heroPool = heroCandidatesData?.posts ?? postsData?.posts ?? [];
  const adminFeatured = featuredPostsData?.posts?.[0];
  const featuredPost = (() => {
    if (adminFeatured) return adminFeatured;
    // Prefer a real community photo (came from WhatsApp and has an image)
    const whatsappPhoto = heroPool.find(
      p => (p as any).sourceSubmissionId != null && p.headerImageUrl
    );
    if (whatsappPhoto) return whatsappPhoto;
    // Fall back to any post with an image (DALL·E generated)
    const anyWithImage = heroPool.find(p => p.headerImageUrl);
    if (anyWithImage) return anyWithImage;
    return heroPool[0] ?? null;
  })();
  const regularPosts = postsData?.posts?.filter(p => p.id !== featuredPost?.id) || [];
  const eventPosts = eventPostsData?.posts || [];

  return (
    <div className="w-full flex flex-col pb-20">
      <CategoryFilter />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-8 md:py-12">
        {isLoadingFeatured || isLoadingPosts ? (
          <div className="w-full h-96 rounded-xl overflow-hidden">
            <Skeleton className="w-full h-full" />
          </div>
        ) : postsError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load articles. Please try again later.</AlertDescription>
          </Alert>
        ) : featuredPost ? (
          <div className="mb-12">
            <ArticleCard 
              post={featuredPost} 
              featured={true}
              categoryName={getCategoryInfo(featuredPost.primaryCategoryId).name}
              categorySlug={getCategoryInfo(featuredPost.primaryCategoryId).slug}
              categoryColor={getCategoryInfo(featuredPost.primaryCategoryId).color}
              sourceName={(featuredPost as any).sourceName}
            />
          </div>
        ) : (
          <div className="text-center py-20 bg-muted rounded-xl">
            <p className="text-muted-foreground font-medium">No articles published yet.</p>
          </div>
        )}
      </section>

      {/* Weekend Guide Feature Block */}
      {weekendGuidePost && (
        <section className="w-full bg-gradient-to-br from-green-700 to-green-800 text-white mb-12" data-testid="weekend-guide-feature">
          <div className="container mx-auto px-4 py-10 md:py-12">
            <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-12">

              {/* Left: text content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-4 h-4 text-green-300 flex-shrink-0" />
                  <span className="text-xs font-bold tracking-widest uppercase text-green-300">
                    Weekend Guide
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug mb-3">
                  {weekendGuidePost.title}
                </h2>
                {weekendGuidePost.excerpt && (
                  <p className="text-green-100 text-sm md:text-base leading-relaxed mb-6 line-clamp-3">
                    {weekendGuidePost.excerpt}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/article/${weekendGuidePost.slug}`}>
                    <Button className="bg-white text-green-800 hover:bg-green-50 font-semibold rounded-full shadow-sm">
                      Read the full guide
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </Link>
                  <Link href="/events">
                    <button className="text-sm text-green-200 hover:text-white underline underline-offset-2 transition-colors">
                      See all events →
                    </button>
                  </Link>
                </div>
              </div>

              {/* Right: image or decorative block */}
              {weekendGuidePost.headerImageUrl ? (
                <div className="flex-shrink-0 w-full md:w-72 h-44 md:h-48 rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src={weekendGuidePost.headerImageUrl}
                    alt={weekendGuidePost.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="hidden md:flex flex-shrink-0 w-56 h-48 rounded-2xl bg-green-600/40 border border-green-500/30 items-center justify-center">
                  <CalendarDays className="w-20 h-20 text-green-400/50" />
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      {/* Events Strip */}
      {eventPosts.length > 0 && (
        <section className="bg-primary/5 py-10 md:py-14 border-y border-primary/10 mb-12" data-testid="events-strip">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">Happening This Weekend</h2>
              </div>
              <Link href={`/category/${eventsCategory?.slug}`}>
                <Button variant="outline" className="hidden sm:flex text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground transition-colors" data-testid="button-all-events">
                  See all events
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {eventPosts.map(post => (
                <ArticleCard 
                  key={`event-${post.id}`} 
                  post={post} 
                  categoryName={getCategoryInfo(post.primaryCategoryId).name}
                  categorySlug={getCategoryInfo(post.primaryCategoryId).slug}
                  categoryColor={getCategoryInfo(post.primaryCategoryId).color}
                  sourceName={(post as any).sourceName}
                />
              ))}
            </div>
            
            <Link href={`/category/${eventsCategory?.slug}`} className="mt-8 block sm:hidden">
              <Button variant="outline" className="w-full text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground">
                See all events
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* WhatsApp Submit CTA */}
      <section className="container mx-auto px-4 mb-12">
        <WhatsAppSubmit />
      </section>

      {/* Main Feed */}
      <section className="container mx-auto px-4">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
          Latest Stories
          <div className="h-px bg-border flex-grow ml-4"></div>
        </h2>
        
        {isLoadingPosts ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col gap-4">
                <Skeleton className="w-full aspect-[4/3] rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full mt-2" />
              </div>
            ))}
          </div>
        ) : regularPosts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-12">
              {regularPosts.map(post => (
                <ArticleCard 
                  key={post.id} 
                  post={post} 
                  categoryName={getCategoryInfo(post.primaryCategoryId).name}
                  categorySlug={getCategoryInfo(post.primaryCategoryId).slug}
                  categoryColor={getCategoryInfo(post.primaryCategoryId).color}
                  sourceName={(post as any).sourceName}
                />
              ))}
            </div>
            
            {postsData?.pagination && postsData.pagination.totalPages > page && (
              <div className="flex justify-center mt-8">
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-full px-8 font-medium hover:bg-muted"
                  data-testid="button-load-more"
                >
                  Load More Stories
                </Button>
              </div>
            )}
          </>
        ) : (
          !featuredPost && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No more stories to display.</p>
            </div>
          )
        )}
      </section>
    </div>
  );
}
