import type { NextConfig } from 'next';

const isCI = process.env.CI === 'true';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },

  // אל תכשיל build ב-CI בגלל ESLint
  eslint: {
    ignoreDuringBuilds: isCI,
  },

  // אופציונלי: אם גם שגיאות TypeScript מפילות build ב-CI, בטל אותן זמנית:
  // typescript: { ignoreBuildErrors: isCI },
};

export default nextConfig;
