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

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

function ProtectedLayout() {
  const [location] = useLocation();

  if (!isLoggedIn()) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/review" component={ReviewQueue} />
          <Route path="/articles" component={Articles} />
          <Route path="/golden" component={GoldenExamples} />
          <Route path="/rss" component={RssFeeds} />
          <Route path="/categories" component={Categories} />
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
