import { useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isLoggedIn } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ReviewQueue from "@/pages/ReviewQueue";
import Articles from "@/pages/Articles";
import GoldenExamples from "@/pages/GoldenExamples";
import Settings from "@/pages/Settings";
import Usage from "@/pages/Usage";
import RssFeeds from "@/pages/RssFeeds";
import Categories from "@/pages/Categories";
import Events from "@/pages/Events";
import Social from "@/pages/Social";
import Entities from "@/pages/Entities";
import ImageAssets from "@/pages/ImageAssets";
import Competitions from "@/pages/Competitions";
import { Menu } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/review": "Review Queue",
  "/articles": "All Articles",
  "/rss": "RSS Feeds",
  "/categories": "Categories",
  "/events": "Events",
  "/social": "Social Media",
  "/entities": "Entity Library",
  "/competitions": "Competitions",
  "/image-assets": "Image Library",
  "/golden": "Golden Examples",
  "/usage": "AI Usage",
  "/settings": "Settings",
};

function ProtectedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();

  if (!isLoggedIn()) {
    return <Redirect to="/login" />;
  }

  const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
    path === "/" ? location === "/" : location.startsWith(path)
  )?.[1] ?? "Admin";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar — hidden on desktop */}
        <header className="md:hidden flex-shrink-0 flex items-center gap-3 px-4 h-14 bg-sidebar text-sidebar-foreground border-b border-sidebar-border z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <img src="/wut-logo-green.png" alt="What's Up Tallaght" className="h-7 w-auto" />
          <span className="text-sm font-medium text-sidebar-foreground ml-1">{pageTitle}</span>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/review" component={ReviewQueue} />
            <Route path="/articles" component={Articles} />
            <Route path="/golden" component={GoldenExamples} />
            <Route path="/rss" component={RssFeeds} />
            <Route path="/categories" component={Categories} />
            <Route path="/events" component={Events} />
            <Route path="/social" component={Social} />
            <Route path="/entities" component={Entities} />
            <Route path="/competitions" component={Competitions} />
            <Route path="/image-assets" component={ImageAssets} />
            <Route path="/usage" component={Usage} />
            <Route path="/settings" component={Settings} />
            <Route>
              <div className="p-8">
                <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
              </div>
            </Route>
          </Switch>
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route component={ProtectedLayout} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}
