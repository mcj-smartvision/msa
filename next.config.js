try {
  require('./scripts/patch-node-dns.cjs')
} catch {
  /* optional: DNS fallback for Tailscale MagicDNS */
}

const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  // Windows dev: webpack pack cache can corrupt routes (intermittent 404 on HMR).
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false
    }
    return config
  },
}
module.exports = nextConfig
