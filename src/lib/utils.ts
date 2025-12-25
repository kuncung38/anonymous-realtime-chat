import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBaseUrl() {
  // Browser
  if (typeof window !== "undefined") {
    return "";
  }

  // Vercel
  if (Bun.env.VERCEL_URL) {
    return `https://${Bun.env.VERCEL_URL}`;
  }

  // Local development
  return "http://localhost:3000";
}
