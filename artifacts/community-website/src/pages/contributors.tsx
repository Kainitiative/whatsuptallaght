import { useState } from "react";
import { useListContributors, getListContributorsQueryKey } from "@workspace/api-client-react";
import { CategoryFilter } from "@/components/category-filter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Contributors() {
  const [page, setPage] = useState(1);
  const limit = 24;

  const { data: contributorsData, isLoading, error } = useListContributors({
    page,
    limit,
  }, {
    query: {
      queryKey: getListContributorsQueryKey({ page, limit }),
    }
  });

  const contributors = contributorsData?.contributors || [];

  const getInitials = (name?: string | null) => {
    if (!name) return "LR";
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="w-full flex flex-col pb-20 bg-background">
      <CategoryFilter />

      {/* Header */}
      <section className="bg-primary text-primary-foreground py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=2000&auto=format&fit=crop')] opacity-10 bg-cover bg-center mix-blend-overlay"></div>
        <div className="container mx-auto px-4 text-center relative z-10 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 drop-shadow-sm">The Faces of Tallaght</h1>
          <p className="text-xl opacity-90 leading-relaxed font-medium">
            Meet the local residents who keep our community informed, connected, and heard. 
            Tallaght Platform is powered entirely by people like you.
          </p>
        </div>
      </section>

      {/* Main Feed */}
      <section className="container mx-auto px-4 py-16">
        {isLoading && page === 1 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(12)].map((_, i) => (
              <Card key={i} className="border border-border">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <Skeleton className="w-24 h-24 rounded-full mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load contributors. Please try again later.</AlertDescription>
          </Alert>
        ) : contributors.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
              {contributors.map(contributor => (
                <Card key={contributor.id} className="border border-card-border hover:shadow-md hover-elevate transition-all duration-300 bg-card overflow-hidden group">
                  <div className="h-16 bg-muted border-b w-full"></div>
                  <CardContent className="p-6 pt-0 flex flex-col items-center text-center relative">
                    <Avatar className="w-24 h-24 border-4 border-card bg-white shadow-sm -mt-12 mb-4 group-hover:scale-105 transition-transform">
                      <AvatarImage src={contributor.profileImageUrl || ''} alt={contributor.displayName || "Contributor"} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                        {getInitials(contributor.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <h3 className="text-xl font-bold text-foreground mb-1 leading-tight">
                      {contributor.displayName || "Local Resident"}
                    </h3>
                    
                    <div className="flex items-center gap-1 text-sm text-muted-foreground font-medium mb-5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{contributor.area || "Tallaght"}</span>
                    </div>
                    
                    <div className="w-full pt-4 border-t border-border flex items-center justify-center gap-2 text-primary font-semibold">
                      <FileText className="w-4 h-4" />
                      <span>{contributor.publishedCount} Published {contributor.publishedCount === 1 ? 'Story' : 'Stories'}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {contributorsData?.pagination && contributorsData.pagination.totalPages > page && (
              <div className="flex justify-center mt-8">
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-full px-8 font-medium border-border"
                  data-testid="button-load-more"
                >
                  Load More Contributors
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-24 bg-muted/30 rounded-xl border border-dashed border-border max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-foreground mb-2">No contributors yet</h3>
            <p className="text-muted-foreground mb-6">Be the first to share your voice on the platform.</p>
            <Button variant="default" className="bg-secondary hover:bg-secondary/90">
              Become a Contributor
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
