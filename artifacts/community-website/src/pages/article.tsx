import { useRoute } from "wouter";
import { format } from "date-fns";
import { 
  useGetPostBySlug, 
  getGetPostBySlugQueryKey,
  useListCategories,
  getListCategoriesQueryKey,
  useListPosts,
  getListPostsQueryKey,
  Post
} from "@workspace/api-client-react";
import { ArticleCard } from "@/components/article-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarDays, User, AlertCircle, Share2, Facebook, Twitter, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCategoryBadgeStyle } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppLoopCTA } from "@/components/whatsapp-loop-cta";

export default function Article() {
  const [, params] = useRoute("/article/:slug");
  const slug = params?.slug;
  const { toast } = useToast();

  const { data: post, isLoading, error } = useGetPostBySlug(slug || "", {
    query: {
      enabled: !!slug,
      queryKey: getGetPostBySlugQueryKey(slug || ""),
    }
  });

  const { data: categories } = useListCategories({
    query: {
      queryKey: getListCategoriesQueryKey(),
    }
  });

  const category = categories?.find(c => c.id === post?.primaryCategoryId);

  const { data: relatedData } = useListPosts({
    status: "published",
    categorySlug: category?.slug,
    limit: 4,
  }, {
    query: {
      enabled: !!category?.slug,
      queryKey: getListPostsQueryKey({ status: "published", categorySlug: category?.slug, limit: 4 }),
    }
  });

  const getCategoryInfo = (categoryId: number | null | undefined) => {
    if (!categoryId || !categories) return { name: "News", slug: "news", color: "" };
    const cat = categories.find(c => c.id === categoryId);
    return cat ? { name: cat.name, slug: cat.slug, color: cat.color } : { name: "News", slug: "news", color: "" };
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: post?.title,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied!",
        description: "The article link has been copied to your clipboard.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-10 w-3/4 mb-6" />
        <div className="flex gap-4 mb-8">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="w-full aspect-[21/9] rounded-xl mb-12" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error ? "Failed to load article." : "Article not found."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const publishDate = post.publishedAt ? new Date(post.publishedAt) : new Date(post.createdAt);
  const formattedDate = format(publishDate, "MMMM d, yyyy");
  
  const badgeStyle = getCategoryBadgeStyle(category?.name || "News", category?.color);

  // Header image — purpose-built wide image (generated or entity). Falls back to placeholder by category.
  const fallbackImages = [
    '/images/tallaght-event.png',
    '/images/tallaght-sport.png',
    '/images/tallaght-business.png',
    '/images/tallaght-news.png'
  ];
  const headerImageUrl = post.headerImageUrl || fallbackImages[post.id % fallbackImages.length];

  // Body images — WhatsApp-submitted photos placed inline after the article text
  const bodyImages: string[] = (post as any).bodyImages ?? [];

  const relatedPosts = relatedData?.posts?.filter(p => p.id !== post.id).slice(0, 3) || [];

  return (
    <article className="w-full pb-20 bg-white">
      {/* Header Image — wide cinematic banner.
           Blurred backdrop fills the 21:7 frame for any image shape (square logos,
           portrait crests, landscape photos) without cropping or stretching. */}
      <div className="w-full overflow-hidden bg-black relative" style={{ aspectRatio: "21/7" }}>
        {/* Blurred fill layer — scaled up so no gaps at edges */}
        <img
          src={headerImageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-50 pointer-events-none select-none"
          style={{ display: "block" }}
        />
        {/* Main image — contained so logos/crests aren't cropped */}
        <img 
          src={headerImageUrl} 
          alt={post.title}
          className="relative w-full h-full object-contain object-center z-10"
          style={{ display: "block" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent z-20" />
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 z-30">
          <div className="container mx-auto max-w-4xl">
            <Badge className={`${badgeStyle} mb-4 text-sm px-3 py-1 font-semibold border-0 shadow-sm`} variant="outline">
              {category?.name || "News"}
            </Badge>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 drop-shadow-md">
              {post.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl mt-8">
        {/* Meta Info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 border-b border-border mb-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground leading-none mb-1">Submitted by</p>
                <p className="font-semibold text-foreground leading-none">Local Resident</p>
              </div>
            </div>
            
            <div className="hidden md:block w-px h-10 bg-border" />
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-5 h-5" />
              <span className="font-medium text-foreground">{formattedDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-2" data-testid="button-share">
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-lg md:prose-xl max-w-none text-foreground prose-headings:font-bold prose-headings:text-foreground prose-a:text-accent">
          {post.excerpt && (
            <p className="lead text-xl md:text-2xl text-muted-foreground font-medium mb-8">
              {post.excerpt}
            </p>
          )}
          
          <div 
            dangerouslySetInnerHTML={{ __html: post.body.replace(/\n/g, '<br/>') }} 
            className="leading-relaxed"
          />
        </div>

        {/* Body Images — WhatsApp-submitted photos displayed below the article text */}
        {bodyImages.length > 0 && (
          <div className="mt-10">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Photos from the community
            </p>
            <div className={`grid gap-4 ${bodyImages.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
              {bodyImages.map((src, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-border bg-muted">
                  <img
                    src={src}
                    alt={`Community photo ${i + 1}`}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Article Footer */}
        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted">
              Tallaght
            </Badge>
            <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted">
              Community
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium mr-2">Share:</span>
            <Button variant="outline" size="icon" className="rounded-full w-10 h-10" onClick={handleShare}>
              <LinkIcon className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full w-10 h-10" onClick={handleShare}>
              <Facebook className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full w-10 h-10" onClick={handleShare}>
              <Twitter className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* WhatsApp Loop CTA */}
      <div className="container mx-auto px-4 max-w-4xl">
        <WhatsAppLoopCTA />
      </div>

      {/* Related Articles Strip */}
      {relatedPosts.length > 0 && (
        <div className="mt-20 bg-muted/30 py-16 border-t border-border">
          <div className="container mx-auto px-4 max-w-6xl">
            <h3 className="text-2xl font-bold mb-8 text-foreground">More in {category?.name || "this category"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {relatedPosts.map((p: Post) => (
                <ArticleCard 
                  key={p.id} 
                  post={p} 
                  categoryName={getCategoryInfo(p.primaryCategoryId).name}
                  categorySlug={getCategoryInfo(p.primaryCategoryId).slug}
                  categoryColor={getCategoryInfo(p.primaryCategoryId).color}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
