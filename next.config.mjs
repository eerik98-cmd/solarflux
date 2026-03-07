/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react', 'recharts'],
  async rewrites() {
    return [
      // Keep legacy /dashboard URLs working while routes live in a route group.
      { source: '/dashboard', destination: '/' },
      { source: '/dashboard/:path*', destination: '/:path*' },
    ];
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    
    // Configure pdfjs-dist for Next.js
    if (!isServer) {
      config.resolve.alias['pdfjs-dist/build/pdf.worker.entry'] = 'pdfjs-dist/build/pdf.worker.mjs';
    }
    
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: ['localhost', '*.github.dev', '*.app.github.dev', '*.githubpreview.dev'],
    },
  },
};

export default nextConfig;
