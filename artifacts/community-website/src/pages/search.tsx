import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Search, MessageCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchResult {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  headerImageUrl: string | null;
  primaryCategoryId: number | null;
  publishedAt: string | null;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  page: number;
  totalPages: number;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export default function SearchPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const initialQ = params.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [input, setInput] = useState(initialQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function doSearch(q: string) {
    if (!q.trim() || q.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`${BASE}/api/public/search?q=${encodeURIComponent(q)}&limit=10`);
      if (!res.ok) throw new Error("Search failed");
      const data: SearchResponse = await res.json();
      setResults(data.results);
      setTotal(data.total);
      setQuery(q);
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialQ) doSearch(initialQ);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(input);
  }

  return (
    <>
    <Helmet>
      <title>Search Tallaght News | What's Up Tallaght</title>
      <meta name="description" content="Search all local news and community stories from Tallaght, Dublin. Find articles about your area, local organisations, events and more." />
      <link rel="canonical" href="https://whatsuptallaght.ie/search" />
      <meta property="og:title" content="Search Tallaght News | What's Up Tallaght" />
      <meta property="og:description" content="Search all local news and community stories from Tallaght, Dublin." />
      <meta property="og:url" content="https://whatsuptallaght.ie/search" />
      <meta property="og:site_name" content="What's Up Tallaght" />
    </Helmet>
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Search</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search Tallaght news…"
            autoFocus
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <Button type="submit" disabled={loading || input.trim().length < 2}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {searched && !loading && (
        <>
          {results.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm mb-2">
                No articles found for <span className="font-medium text-foreground">"{query}"</span>
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Know something about this? Be the first to report it.
              </p>
              <a
                href="https://wa.me/353857141023"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp us your story
                </Button>
              </a>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {total} result{total !== 1 ? "s" : ""} for <span className="font-medium text-foreground">"{query}"</span>
              </p>
              <div className="space-y-4">
                {results.map((r) => (
                  <Link key={r.id} href={`/article/${r.slug}`}>
                    <div className="flex gap-4 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group">
                      {r.headerImageUrl && (
                        <img
                          src={`${BASE}${r.headerImageUrl}`}
                          alt={r.title}
                          className="w-20 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                          {r.title}
                        </h3>
                        {r.excerpt && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.excerpt}</p>
                        )}
                        {r.publishedAt && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{timeAgo(r.publishedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!searched && (
        <p className="text-sm text-muted-foreground text-center py-12">
          Type something to search across all published articles.
        </p>
      )}
    </div>
    </>
  );
}
