import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../../'),
  webpack(config, { dev }) {
    // En dev, caché en memoria: evita escribir .next/cache/webpack/*.pack.gz, que en Windows
    // dispara el diálogo de "abrir archivo comprimido" cuando algo vigila la carpeta
    if (dev) config.cache = { type: 'memory' };
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
