import type { NextConfig } from "next";

const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [
  {
    protocol: 'https',
    hostname: 'images.unsplash.com',
  },
];

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

try {
  const parsed = new URL(apiUrl);
  remotePatterns.push({
    protocol: parsed.protocol.replace(':', '') as 'http' | 'https',
    hostname: parsed.hostname,
    port: parsed.port || undefined,
  });
} catch {
  remotePatterns.push({
    protocol: 'http',
    hostname: 'localhost',
    port: '3000',
  });
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
