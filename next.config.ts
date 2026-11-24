import type { NextConfig } from "next";

/**
 * Modo padrão: servidor Next (preview da plataforma).
 * GitHub Pages: `npm run build:pages` define GITHUB_PAGES=true e NEXT_PUBLIC_BASE_PATH=/<repositório>
 * e gera um site 100% estático em ./out (sem backend).
 */
const isPages = process.env.GITHUB_PAGES === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(isPages ? { output: "export" as const, trailingSlash: true } : {}),
  basePath: basePath || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
