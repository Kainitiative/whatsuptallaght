import { Link, useLocation } from "wouter";
import { useListCategories } from "@workspace/api-client-react";
import { getListCategoriesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { getCategoryBadgeStyle } from "@/lib/utils";

export function CategoryFilter() {
  const [location] = useLocation();
  const { data: categories } = useListCategories({
    query: {
      queryKey: getListCategoriesQueryKey(),
    }
  });

  const isActive = (slug: string) => {
    return location === `/category/${slug}`;
  };

  const isHome = location === "/";

  if (!categories || categories.length === 0) return null;

  return (
    <div className="w-full border-y bg-white sticky top-16 z-40" data-testid="category-filter-bar">
      <div className="container mx-auto px-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex w-max space-x-2 p-3">
            <Link href="/">
              <Button 
                variant={isHome ? "default" : "outline"} 
                size="sm"
                className={`rounded-full font-medium ${isHome ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-transparent text-foreground hover:bg-muted'}`}
                data-testid="filter-all"
              >
                All Stories
              </Button>
            </Link>
            
            {categories.map((category) => {
              const active = isActive(category.slug);
              // Extract the base color class from our utility to use dynamically
              const badgeStyle = getCategoryBadgeStyle(category.name, category.color);
              
              return (
                <Link key={category.id} href={`/category/${category.slug}`}>
                  <Button 
                    variant={active ? "default" : "outline"} 
                    size="sm"
                    className={`rounded-full font-medium transition-colors ${
                      active 
                        ? badgeStyle 
                        : 'bg-transparent text-foreground hover:bg-muted border-border'
                    }`}
                    data-testid={`filter-${category.slug}`}
                  >
                    {category.name}
                  </Button>
                </Link>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </div>
    </div>
  );
}
