import type { NextConfig } from 'next';

let apiServerOrigin: string | undefined;
if (process.env.API_SERVER_ORIGIN) {
  try {
    const url = new URL(process.env.API_SERVER_ORIGIN);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error();
    apiServerOrigin = url.origin;
  } catch {
    throw new Error('API_SERVER_ORIGIN must be an HTTPS origin without credentials or a path');
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  async rewrites() {
    return apiServerOrigin
      ? [{ source: '/api/:path*', destination: `${apiServerOrigin}/api/:path*` }]
      : [];
  },
  async headers() {
    return [
      {
        source: '/api/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'x-vercel-enable-rewrite-caching', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
