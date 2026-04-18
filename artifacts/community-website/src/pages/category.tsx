import { useState } from "react";
import { useRoute } from "wouter";
import { Helmet } from "react-helmet-async";
import { 
  useListPosts, 
  getListPostsQueryKey, 
  useListCategories, 
  getListCategoriesQueryKey,
  useGetCategory,
  getGetCategoryQueryKey
} from "@workspace/api-client-react";
import { ArticleCard } from "@/components/article-card";
import { CategoryFilter } from "@/components/category-filter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Category() {
  const [, params] = useRoute("/category/:slug");
  const slug = params?.slug;
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data: categoryData, isLoading: isLoadingCategory } = useGetCategory(slug || "", {
    query: {
      enabled: !!slug,
      queryKey: getGetCategoryQueryKey(slug || ""),
    }
  });

  const { data: postsData, isLoading: isLoadingPosts, error: postsError } = useListPosts({
    status: "published",
    categorySlug: slug,
    page,
    limit,
  }, {
    query: {
      enabled: !!slug,
      queryKey: getListPostsQueryKey({ status: "published", categorySlug: slug, page, limit }),
    }
  });

  const { data: categories } = useListCategories({
    query: {
      queryKey: getListCategoriesQueryKey(),
    }
  });

  const getCategoryInfo = (categoryId: number | null | undefined) => {
    if (!categoryId || !categories) return { name: "News", slug: "news", color: "" };
    const category = categories.find(c => c.id === categoryId);
    return category ? { name: category.name, slug: category.slug, color: category.color } : { name: "News", slug: "news", color: "" };
  };

  const posts = postsData?.posts || [];

  const categoryTitle = categoryData?.name
    ? `${categoryData.name} News Tallaght | What's Up Tallaght`
    : "Tallaght News | What's Up Tallaght";
  const categoryDescription = categoryData?.description
    ? categoryData.description
    : `The latest ${categoryData?.name ?? "community"} news and stories from Tallaght, Dublin.`;

  return (
    <>
    <Helmet>
      <title>{categoryTitle}</title>
      <meta name="description" content={categoryDescription} />
      <meta property="og:title" content={categoryTitle} />
      <meta property="og:description" content={categoryDescription} />
      <meta property="og:site_name" content="What's Up Tallaght" />
    </Helmet>
    <div className="w-full flex flex-col pb-20">
      <CategoryFilter />

      {/* Category Header */}
      <section className="bg-card border-b py-12 md:py-16">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          {isLoadingCategory ? (
            <>
              <Skeleton className="h-10 w-48 mx-auto mb-4" />
              <Skeleton className="h-6 w-full mx-auto max-w-lg" />
            </>
          ) : (
            <>
              <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
                {categoryData?.name || "Category"}
              </h1>
              {categoryData?.description && (
                <p className="text-lg text-muted-foreground">
                  {categoryData.description}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Main Feed */}
      <section className="container mx-auto px-4 py-12">
        {isLoadingPosts && page === 1 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col gap-4">
                <Skeleton className="w-full aspect-[4/3] rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : postsError ? (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load articles. Please try again later.</AlertDescription>
          </Alert>
        ) : posts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-12">
              {posts.map(post => (
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
          <div className="text-center py-24 bg-muted/30 rounded-xl border border-dashed border-border max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-foreground mb-2">No articles found</h3>
            <p className="text-muted-foreground mb-6">There are no published articles in this category yet.</p>
            <Button variant="default" className="bg-secondary hover:bg-secondary/90">
              Submit a story for this category
            </Button>
          </div>
        )}
      </section>
    </div>
    </>
  );
}
