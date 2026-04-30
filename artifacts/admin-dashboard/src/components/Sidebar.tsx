import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { clearToken, apiFetch, isLoggedIn } from "@/lib/api";
import { X } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: "⬛" },
  { href: "/review", label: "Review Queue", icon: "🔶" },
  { href: "/articles", label: "All Articles", icon: "📰" },
  { href: "/rss", label: "RSS Feeds", icon: "📡" },
  { href: "/categories", label: "Categories", icon: "🏷️" },
  { href: "/events", label: "Events", icon: "📅" },
  { href: "/social", label: "Social Media", icon: "📱" },
  { href: "/entities", label: "Entity Library", icon: "🏛️" },
  { href: "/entity-pages", label: "Entity Pages", icon: "📄" },
  { href: "/competitions", label: "Competitions", icon: "🏆" },
  { href: "/image-assets", label: "Image Library", icon: "🖼️" },
  { href: "/golden", label: "Golden Examples", icon: "⭐" },
  { href: "/usage", label: "AI Usage", icon: "📊" },
  { href: "/directory", label: "Business Directory", icon: "🏪" },
  { href: "/contact-messages", label: "Contact Messages", icon: "✉️" },
  { href: "/newsletter", label: "Newsletter", icon: "📨" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const [location] = useLocation();

  const { data: contactData } = useQuery({
    queryKey: ["contact-unread-count"],
    queryFn: () => apiFetch("/contact").then((r) => r.json()),
    enabled: isLoggedIn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unreadCount: number = contactData?.unreadCount ?? 0;

  function logout() {
    clearToken();
    window.location.href = import.meta.env.BASE_URL + "login";
  }

  function handleNavClick() {
    onClose?.();
  }

  const sidebarContent = (
    <aside className="w-56 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-full">
      <div className="px-4 py-4 border-b border-sidebar-border flex items-center justify-between">
        <div>
          <img src="/wut-logo-green.png" alt="What's Up Tallaght" className="h-9 w-auto" />
          <p className="text-xs text-sidebar-foreground/40 mt-1.5 pl-0.5">Admin Dashboard</p>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.href === "/"
            ? location === "/"
            : location.startsWith(item.href);
          const badge = item.href === "/contact-messages" && unreadCount > 0 ? unreadCount : null;
          return (
            <Link key={item.href} href={item.href}>
              <a
                onClick={handleNavClick}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {badge !== null && (
                  <span className="ml-auto flex-shrink-0 bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                    {badge}
                  </span>
                )}
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

  return (
    <>
      {/* Desktop — always visible sticky sidebar */}
      <div className="hidden md:flex h-screen sticky top-0">
        {sidebarContent}
      </div>

      {/* Mobile — slide-in drawer with backdrop */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden
          />
          {/* Drawer */}
          <div className="relative flex h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
