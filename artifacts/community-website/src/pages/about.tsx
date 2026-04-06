import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, ShieldCheck, Newspaper } from "lucide-react";
import { CategoryFilter } from "@/components/category-filter";
import { useQuery } from "@tanstack/react-query";

interface PublicConfig {
  whatsappNumber: string | null;
  platformName: string;
  platformUrl: string | null;
}

function toWaNumber(displayNumber: string): string {
  const digits = displayNumber.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length <= 11) return "353" + digits.slice(1);
  return digits;
}

async function fetchPublicConfig(): Promise<PublicConfig> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/public/config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

export default function About() {
  const { data: config } = useQuery<PublicConfig>({
    queryKey: ["public-config"],
    queryFn: fetchPublicConfig,
    staleTime: 10 * 60 * 1000,
  });

  const displayNumber = config?.whatsappNumber ?? null;
  const waNumber = displayNumber ? toWaNumber(displayNumber) : null;
  const waUrl = waNumber ? `https://wa.me/${waNumber}` : null;

  return (
    <div className="w-full flex flex-col bg-background pb-20">
      <CategoryFilter />
      
      {/* Hero */}
      <section className="bg-card border-b py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight">
            News by the community,<br/>
            <span className="text-primary">for the community.</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto mb-10">
            Tallaght Platform is a new kind of local news. No journalists, no paywalls. Just local people sharing what's happening right now in our neighbourhoods.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noreferrer">
                <Button size="lg" className="bg-secondary hover:bg-secondary/90 text-white rounded-full font-bold h-14 px-8 text-lg w-full sm:w-auto shadow-md hover-elevate">
                  <MessageCircle className="w-5 h-5 mr-3" />
                  Submit via WhatsApp
                </Button>
              </a>
            ) : (
              <Button size="lg" disabled className="rounded-full font-bold h-14 px-8 text-lg w-full sm:w-auto">
                <MessageCircle className="w-5 h-5 mr-3" />
                Submit via WhatsApp
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-28 container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-foreground">How it works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-border z-0"></div>
            
            <div className="relative z-10 flex flex-col items-center text-center bg-background">
              <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-8 shadow-sm">
                <MessageCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-4">1. Send a message</h3>
              <p className="text-muted-foreground text-lg">
                See something happening? Got an event? Send a quick WhatsApp message with a photo or voice note
                {displayNumber ? <> to <span className="font-bold text-foreground">{displayNumber}</span>.</> : "."}
              </p>
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center bg-background">
              <div className="w-24 h-24 rounded-full bg-secondary/10 text-secondary flex items-center justify-center mb-8 shadow-sm">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-4">2. AI processes it</h3>
              <p className="text-muted-foreground text-lg">
                Our smart system turns your raw voice notes or quick texts into a professionally formatted, easy-to-read news article.
              </p>
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center bg-background">
              <div className="w-24 h-24 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-8 shadow-sm">
                <Newspaper className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-4">3. Published instantly</h3>
              <p className="text-muted-foreground text-lg">
                Approved stories appear right here on the platform. You get credited, and the community stays informed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What we publish */}
      <section className="bg-muted py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-foreground">What kind of stories do we publish?</h2>
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <CheckCircle2 className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-xl block mb-1 text-foreground">Local Events</strong>
                    <span className="text-muted-foreground">Festivals, fundraisers, charity runs, or community meetings. Let people know what's on.</span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <CheckCircle2 className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-xl block mb-1 text-foreground">Sport Results</strong>
                    <span className="text-muted-foreground">Match reports, league updates, and achievements from local clubs.</span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <CheckCircle2 className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-xl block mb-1 text-foreground">Business News</strong>
                    <span className="text-muted-foreground">New shop openings, special offers, or local services available in the area.</span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <CheckCircle2 className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-xl block mb-1 text-foreground">Community Notices</strong>
                    <span className="text-muted-foreground">Traffic updates, missing pets, public warnings, or council developments.</span>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="bg-card p-8 md:p-10 rounded-2xl shadow-sm border border-border flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center mb-6">
                <MessageCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Ready to share?</h3>
              <p className="text-muted-foreground mb-8 text-lg">
                Add our number to your contacts and send us a message on WhatsApp. We accept photos, videos, text, and voice notes.
              </p>
              <div className="bg-muted p-4 rounded-xl w-full mb-8 font-mono text-2xl font-bold tracking-widest text-foreground">
                {displayNumber ?? "—"}
              </div>
              {waUrl ? (
                <a href={waUrl} target="_blank" rel="noreferrer" className="w-full">
                  <Button size="lg" className="w-full bg-[#25D366] hover:bg-[#20B954] text-white rounded-full font-bold h-14 text-lg shadow-sm hover-elevate">
                    Open WhatsApp
                  </Button>
                </a>
              ) : (
                <Button size="lg" disabled className="w-full rounded-full font-bold h-14 text-lg">
                  Open WhatsApp
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
