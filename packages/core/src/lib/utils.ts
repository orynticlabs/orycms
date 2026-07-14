import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number) {
  return inrFormatter.format(value);
}

export function formatCompactCurrency(value: number) {
  if (value >= 100000) {
    return `${formatCurrency(value / 100000)}L`;
  }

  if (value >= 1000) {
    return `${formatCurrency(value / 1000)}k`;
  }

  return formatCurrency(value);
}
