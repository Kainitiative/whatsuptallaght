import { useState, useRef } from "react";
import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MessageCircle, Menu, Search } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery("");
  }

  const NavLinks = () => (
    <>
      <Link href="/" className="text-sm font-medium hover:text-primary transition-colors data-[active]:text-primary">
        Home
      </Link>
      <Link href="/contributors" className="text-sm font-medium hover:text-primary transition-colors">
        Contributors
      </Link>
      <Link href="/advertise" className="text-sm font-medium hover:text-primary transition-colors">
        Advertise
      </Link>
      <Link href="/about" className="text-sm font-medium hover:text-primary transition-colors">
        About
      </Link>
    </>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col w-full bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6 md:gap-10">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-md flex items-center justify-center font-bold text-xl leading-none">
                T
              </div>
              <span className="font-bold text-xl tracking-tight text-foreground hidden sm:inline-block">
                Tallaght <span className="text-primary">Platform</span>
              </span>
            </Link>
            <nav className="hidden md:flex gap-6">
              <NavLinks />
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles…"
                  className="w-48 sm:w-64 px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setSearchOpen(false)} className="text-muted-foreground">
                  ✕
                </Button>
              </form>
            ) : (
              <Button variant="ghost" size="icon" onClick={openSearch} aria-label="Search" data-testid="button-search">
                <Search className="h-5 w-5" />
              </Button>
            )}
            <Link href="/about">
              <Button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full hidden sm:flex font-semibold shadow-sm" data-testid="button-whatsapp-header">
                <MessageCircle className="w-4 h-4 mr-2" />
                Send us your story
              </Button>
            </Link>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex flex-col gap-6">
                <div className="flex items-center gap-2 mt-4">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-md flex items-center justify-center font-bold text-xl leading-none">
                    T
                  </div>
                  <span className="font-bold text-xl tracking-tight">Tallaght Platform</span>
                </div>
                <nav className="flex flex-col gap-4 mt-8">
                  <NavLinks />
                </nav>
                <div className="mt-auto pb-8">
                  <Link href="/about">
                    <Button className="w-full bg-secondary hover:bg-secondary/90 text-white rounded-full font-semibold" data-testid="button-whatsapp-mobile">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Send us your story
                    </Button>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        {children}
      </main>

      <footer className="border-t bg-card text-card-foreground">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-4">
              <Link href="/" className="flex items-center gap-2 inline-flex">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-md flex items-center justify-center font-bold text-xl leading-none">
                  T
                </div>
                <span className="font-bold text-xl tracking-tight">
                  Tallaght Platform
                </span>
              </Link>
              <p className="text-muted-foreground max-w-sm">
                The hyper-local, AI-powered community news site serving Tallaght, Dublin. Real local faces, real community voices.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Explore</h4>
              <ul className="space-y-2">
                <li><Link href="/" className="text-muted-foreground hover:text-primary transition-colors text-sm">Home</Link></li>
                <li><Link href="/search" className="text-muted-foreground hover:text-primary transition-colors text-sm">Search</Link></li>
                <li><Link href="/contributors" className="text-muted-foreground hover:text-primary transition-colors text-sm">Contributors</Link></li>
                <li><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors text-sm">How it works</Link></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Partner</h4>
              <ul className="space-y-2">
                <li><Link href="/advertise" className="text-muted-foreground hover:text-primary transition-colors text-sm">Advertise with us</Link></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">Local Business Directory</a></li>
                <li><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors text-sm">Submit a Story</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Tallaght Community Platform. Made for Tallaght.</p>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="hover:text-primary transition-colors">Terms of Use</Link>
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
