import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
    <html lang="en" className="h-[100dvh] overflow-hidden" style={{ colorScheme: "light" }}>
      <body className={`${inter.variable} font-inter antialiased h-[100dvh] overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
