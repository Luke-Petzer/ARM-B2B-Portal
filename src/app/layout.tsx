import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/consent/CookieBanner";
import PreferencesModal from "@/components/consent/PreferencesModal";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AR Steel Manufacturing",
  description: "Precision-manufactured steel products and hardware solutions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" style={{ colorScheme: "light" }}>
      <body className={`${inter.variable} font-inter antialiased`}>
        {children}
        <CookieBanner />
        <PreferencesModal />
      </body>
    </html>
  );
}
