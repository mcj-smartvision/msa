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
}
module.exports = nextConfig
