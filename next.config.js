/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ottimizzazioni performance
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production', // rimuove console.log in prod
  },
  // firebase-admin usa moduli nativi (@grpc/grpc-js) che non possono essere bundlati da Webpack
  serverExternalPackages: ['firebase-admin', '@google-cloud/firestore', '@grpc/grpc-js'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
};

module.exports = nextConfig;
