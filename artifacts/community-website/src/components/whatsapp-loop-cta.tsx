import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Camera, Mic, FileText } from "lucide-react";

interface PublicConfig {
  whatsappNumber: string | null;
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

export function WhatsAppLoopCTA() {
  const { data: config } = useQuery<PublicConfig>({
    queryKey: ["public-config"],
    queryFn: fetchPublicConfig,
    staleTime: 10 * 60 * 1000,
  });

  const waNumber = config?.whatsappNumber ? toWaNumber(config.whatsappNumber) : null;
  const waUrl = waNumber
    ? `https://wa.me/${waNumber}?text=Hi%2C%20I%20have%20a%20story%20for%20What%27s%20Up%20Tallaght!`
    : null;

  return (
    <div className="my-16 rounded-2xl overflow-hidden bg-zinc-900 text-white">
      <div className="px-8 py-10 md:px-12 md:py-12">

        {/* Hook */}
        <p className="text-[#25D366] text-sm font-bold tracking-widest uppercase mb-3">
          What's Up Tallaght
        </p>
        <h2 className="text-2xl md:text-3xl font-bold leading-snug mb-2">
          Got something going on?
        </h2>
        <p className="text-zinc-300 text-lg font-medium mb-6">
          Send it in&nbsp;👇
        </p>

        {/* Accepted formats */}
        <div className="flex flex-wrap gap-3 mb-8">
          {[
            { icon: Camera, label: "Photo" },
            { icon: Mic, label: "Voice note" },
            { icon: FileText, label: "Text message" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 bg-white/10 text-zinc-200 text-sm font-medium px-3 py-1.5 rounded-full"
            >
              <Icon className="w-3.5 h-3.5 text-[#25D366]" />
              {label}
            </span>
          ))}
        </div>

        {/* CTA button */}
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-base px-7 py-3.5 rounded-full shadow-lg transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            Send us your story
          </a>
        ) : (
          <span className="inline-flex items-center gap-2.5 bg-[#25D366]/40 text-white font-bold text-base px-7 py-3.5 rounded-full">
            <MessageCircle className="w-5 h-5" />
            Send us your story
          </span>
        )}

        <p className="text-zinc-500 text-xs mt-4">
          Your stories shape this community — no account needed
        </p>
      </div>
    </div>
  );
}
