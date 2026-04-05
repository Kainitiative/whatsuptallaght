import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { MessageCircle, Smartphone, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

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

export function WhatsAppSubmit() {
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: config } = useQuery<PublicConfig>({
    queryKey: ["public-config"],
    queryFn: fetchPublicConfig,
    staleTime: 10 * 60 * 1000,
  });

  const displayNumber = config?.whatsappNumber;
  const waNumber = displayNumber ? toWaNumber(displayNumber) : null;
  const waUrl = waNumber ? `https://wa.me/${waNumber}` : null;

  const handleDownload = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tallaght-community-whatsapp-qr.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="bg-gradient-to-br from-[#25D366]/10 to-[#128C7E]/10 border border-[#25D366]/20 rounded-2xl overflow-hidden">
      <div className="container mx-auto px-6 py-10 md:py-14">
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">

          {/* QR Code */}
          <div className="flex-shrink-0 flex flex-col items-center gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              {waUrl ? (
                <QRCodeSVG
                  ref={svgRef}
                  value={waUrl}
                  size={160}
                  marginSize={1}
                  fgColor="#128C7E"
                />
              ) : (
                <div className="w-40 h-40 bg-muted rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/40" />
                </div>
              )}
            </div>
            {waUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-muted-foreground hover:text-foreground gap-2 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Download QR
              </Button>
            )}
          </div>

          {/* Text content */}
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-[#25D366]/15 text-[#075E54] dark:text-[#25D366] text-sm font-semibold px-3 py-1 rounded-full mb-4">
              <MessageCircle className="w-4 h-4" />
              Submit via WhatsApp
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Got a story for Tallaght?
            </h2>

            <p className="text-muted-foreground text-base mb-6 max-w-md">
              Scan the QR code or tap the button below to send us your story, photo, or voice note on WhatsApp. No app, no account — just message us.
            </p>

            <div className="flex flex-col sm:flex-row items-center md:items-start gap-3">
              {waUrl ? (
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    className="bg-[#25D366] hover:bg-[#1ebe5d] text-white gap-2 rounded-full font-semibold shadow-md"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Open WhatsApp
                  </Button>
                </a>
              ) : (
                <Button size="lg" disabled className="rounded-full gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Open WhatsApp
                </Button>
              )}

              {displayNumber && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Smartphone className="w-4 h-4" />
                  <span className="font-mono font-medium">{displayNumber}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-5 max-w-sm">
              Scan on desktop · tap on mobile · your stories shape this community
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
