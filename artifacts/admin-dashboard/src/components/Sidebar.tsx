import { Link, useLocation } from "wouter";
import { clearToken } from "@/lib/api";

const NAV = [
  { href: "/", label: "Dashboard", icon: "⬛" },
  { href: "/review", label: "Review Queue", icon: "🔶" },
  { href: "/articles", label: "All Articles", icon: "📰" },
  { href: "/rss", label: "RSS Feeds", icon: "📡" },
  { href: "/categories", label: "Categories", icon: "🏷️" },
  { href: "/events", label: "Events", icon: "📅" },
  { href: "/social", label: "Social Media", icon: "📱" },
  { href: "/entities", label: "Entity Library", icon: "🏛️" },
  { href: "/golden", label: "Golden Examples", icon: "⭐" },
  { href: "/usage", label: "AI Usage", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const [location] = useLocation();

  function logout() {
    clearToken();
    window.location.href = import.meta.env.BASE_URL + "login";
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <img src="/wut-logo-green.png" alt="What's Up Tallaght" className="h-9 w-auto" />
        <p className="text-xs text-sidebar-foreground/40 mt-1.5 pl-0.5">Admin Dashboard</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = item.href === "/"
            ? location === "/"
            : location.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <a className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}>
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </a>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <span className="text-base leading-none">🚪</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
