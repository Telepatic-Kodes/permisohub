import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfkit'],
  turbopack: {
    // Workaround: NFD unicode path bug in Turbopack on macOS (Estefanía dir)
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json', '.css'],
  },
};

export default nextConfig;
