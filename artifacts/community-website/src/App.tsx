import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Article from "@/pages/article";
import Category from "@/pages/category";
import Contributors from "@/pages/contributors";
import About from "@/pages/about";
import Advertise from "@/pages/advertise";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import SearchPage from "@/pages/search";
import EventsPage from "@/pages/events";
import TallaghtNewsPage from "@/pages/tallaght-news";
import TallaghtCommunityPage from "@/pages/tallaght-community";
import WhatsOnTallaghtPage from "@/pages/whats-on-tallaght";
import PlacePage from "@/pages/place";
import ContactPage from "@/pages/contact";
import WeatherPage from "@/pages/weather";
import DirectoryPage from "@/pages/directory";
import BusinessProfilePage from "@/pages/business-profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/article/:slug" component={Article} />
        <Route path="/category/:slug" component={Category} />
        <Route path="/contributors" component={Contributors} />
        <Route path="/about" component={About} />
        <Route path="/advertise" component={Advertise} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/search" component={SearchPage} />
        <Route path="/events" component={EventsPage} />
        <Route path="/tallaght-news" component={TallaghtNewsPage} />
        <Route path="/tallaght-community" component={TallaghtCommunityPage} />
        <Route path="/whats-on-tallaght" component={WhatsOnTallaghtPage} />
        <Route path="/place/:slug" component={PlacePage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/weather" component={WeatherPage} />
        <Route path="/directory/:slug" component={BusinessProfilePage} />
        <Route path="/directory" component={DirectoryPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
