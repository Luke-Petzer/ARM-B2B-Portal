import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import LogoutOverlay from "@/components/LogoutOverlay";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ordering Portal",
  description: "B2B Ordering Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-[100dvh] overflow-hidden">
      <body className={`${inter.variable} font-inter antialiased h-[100dvh] overflow-hidden`}>
        {children}
        {/* LogoutOverlay is a direct child of <body> — outside every overflow-hidden
            and backdrop-filter container — so fixed inset-0 always covers the full
            viewport on all browsers including iOS Safari */}
        <LogoutOverlay />
      </body>
    </html>
  );
}
