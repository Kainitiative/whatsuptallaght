import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCategoryBadgeStyle(categoryName: string, fallbackColor: string = "") {
  if (!categoryName) return "bg-muted-foreground text-white";

  const name = categoryName.toLowerCase();
  
  if (name.includes("event") || name.includes("what's on") || name.includes("happening")) {
    return "bg-primary text-primary-foreground"; // Red
  }
  if (name.includes("community") || name.includes("notice")) {
    return "bg-secondary text-secondary-foreground"; // Green
  }
  if (name.includes("sport") || name.includes("active")) {
    return "bg-accent text-accent-foreground"; // Blue
  }
  if (name.includes("business") || name.includes("service") || name.includes("local")) {
    return "bg-[#f59e0b] text-white"; // Warm Amber
  }
  if (name.includes("news") || name.includes("issue")) {
    return "bg-[#334155] text-white"; // Charcoal
  }
  
  // Use provided color if available
  if (fallbackColor && fallbackColor !== "") {
    // If it's a known semantic color
    if (fallbackColor === "red" || fallbackColor === "primary") return "bg-primary text-primary-foreground";
    if (fallbackColor === "green" || fallbackColor === "secondary") return "bg-secondary text-secondary-foreground";
    if (fallbackColor === "blue" || fallbackColor === "accent") return "bg-accent text-accent-foreground";
  }

  // Fallback
  return "bg-muted-foreground text-white";
}
