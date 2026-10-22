/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    /*
     * These are barrel packages: `import { Search } from "lucide-react"` pulls
     * the package index, which re-exports every icon in the set. Next rewrites
     * such imports to deep per-module imports so only the icons actually used
     * end up in the bundle. lucide-react in particular is ~1000 modules.
     */
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },

  compiler: {
    // Strip console noise from production bundles (keep errors/warnings).
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
};

module.exports = nextConfig;
