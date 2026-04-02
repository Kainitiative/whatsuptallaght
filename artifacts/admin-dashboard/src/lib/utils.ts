import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function statusColour(status: string): string {
  switch (status) {
    case "published": return "bg-green-100 text-green-800";
    case "held": return "bg-amber-100 text-amber-800";
    case "rejected": return "bg-red-100 text-red-800";
    case "draft": return "bg-gray-100 text-gray-600";
    default: return "bg-gray-100 text-gray-600";
  }
}

export function confidenceColour(score: string | null): string {
  if (!score) return "text-gray-400";
  const n = parseFloat(score);
  if (n >= 0.85) return "text-green-600";
  if (n >= 0.65) return "text-amber-600";
  return "text-red-600";
}
