import type { Metadata } from "next";
import "./../styles.css";

export const metadata: Metadata = {
  title: "OryCMS by OrynticLabs Private Limited",
  description:
    "OryCMS by OrynticLabs Private Limited for managing products, orders, customers, inventory, marketing, and analytics.",
  openGraph: {
    title: "OryCMS by OrynticLabs Private Limited",
    description: "OryCMS by OrynticLabs Private Limited for managing your entire storefront.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
