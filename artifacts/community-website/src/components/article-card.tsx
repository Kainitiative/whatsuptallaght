import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Clock } from "lucide-react";
import { Post } from "@workspace/api-client-react";
import { getCategoryColorClass, getCategoryBadgeStyle } from "@/lib/utils";

interface ArticleCardProps {
  post: Post;
  categoryName?: string;
  categorySlug?: string;
  categoryColor?: string;
  contributorName?: string | null;
  contributorArea?: string | null;
  sourceName?: string | null;
  featured?: boolean;
}

export function ArticleCard({ 
  post, 
  categoryName = "News", 
  categorySlug = "news", 
  categoryColor = "charcoal",
  contributorName,
  contributorArea,
  sourceName,
  featured = false
}: ArticleCardProps) {
  
  // Try to use real provided images, fallback to generated
  const fallbackImages = [
    '/images/tallaght-event.png',
    '/images/tallaght-sport.png',
    '/images/tallaght-business.png',
    '/images/tallaght-news.png'
  ];
  
  // Use post id to predictably pick a fallback if none provided
  const imgIndex = post.id % fallbackImages.length;
  const imageUrl = post.headerImageUrl || fallbackImages[imgIndex];

  const timeAgo = post.publishedAt 
    ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })
    : formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  const badgeStyle = getCategoryBadgeStyle(categoryName, categoryColor);
  
  const isRssSource = !!sourceName;
  const displayAuthor = sourceName
    ? sourceName
    : contributorName
      ? `${contributorName}${contributorArea ? `, ${contributorArea}` : ''}`
      : 'Local Resident';
  const authorPrefix = isRssSource ? 'Via' : 'Submitted by';

  if (featured) {
    return (
      <Link href={`/article/${post.slug}`}>
        <Card className="overflow-hidden border-0 shadow-md hover-elevate transition-all duration-300 group cursor-pointer bg-card h-full flex flex-col md:flex-row" data-testid={`card-post-featured-${post.id}`}>
          <div className="w-full md:w-2/3 h-64 md:h-80 relative overflow-hidden bg-black">
            {/* Blurred backdrop so square logos/crests don't push the card height */}
            <img
              src={imageUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl brightness-50 pointer-events-none select-none"
            />
            <img 
              src={imageUrl} 
              alt={post.title} 
              className="relative w-full h-full object-contain transition-transform duration-700 group-hover:scale-105 z-10"
            />
            <div className="absolute top-4 left-4 z-10">
              <Badge className={`${badgeStyle} shadow-sm border-0 font-medium px-3 py-1 text-xs`} variant="outline">
                {categoryName}
              </Badge>
            </div>
          </div>
          <CardContent className="w-full md:w-1/3 p-6 md:p-8 flex flex-col justify-center bg-card">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>{timeAgo}</span>
            </div>
            
            <h2 className="text-2xl md:text-3xl font-bold mb-4 line-clamp-3 text-foreground leading-tight group-hover:text-primary transition-colors">
              {post.title}
            </h2>
            
            {post.excerpt && (
              <p className="text-muted-foreground mb-6 line-clamp-3 leading-relaxed">
                {post.excerpt}
              </p>
            )}
            
            <div className="mt-auto pt-4 flex items-center gap-3 border-t">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium text-foreground">
                <span className="text-muted-foreground font-normal">{authorPrefix} </span>
                {displayAuthor}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/article/${post.slug}`}>
      <Card className="overflow-hidden border border-card-border shadow-sm hover-elevate transition-all duration-300 group cursor-pointer bg-card h-full flex flex-col" data-testid={`card-post-${post.id}`}>
        <div className="w-full aspect-[4/3] relative overflow-hidden bg-muted">
          <img 
            src={imageUrl} 
            alt={post.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute top-3 left-3 z-10">
            <Badge className={`${badgeStyle} shadow-sm border-0 font-medium`} variant="outline">
              {categoryName}
            </Badge>
          </div>
        </div>
        
        <CardContent className="p-5 flex flex-col flex-grow">
          <h3 className="text-lg font-bold mb-3 line-clamp-2 text-foreground leading-snug group-hover:text-accent transition-colors">
            {post.title}
          </h3>
          
          <div className="mt-auto pt-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>{timeAgo}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-foreground bg-black/5 px-2 py-1 rounded-md">
                <span className="text-muted-foreground font-normal">{authorPrefix} </span>
                {displayAuthor}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
