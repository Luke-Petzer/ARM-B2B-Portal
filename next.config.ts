import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Typed routes — catches broken hrefs at build time (Next.js 16+)
  typedRoutes: true,
  images: {
    // Allow Supabase Storage as an image source; update with your project ref.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
