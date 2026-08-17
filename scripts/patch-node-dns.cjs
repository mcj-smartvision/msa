'use strict'

/**
 * Tailscale MagicDNS on Windows sometimes returns ENOTFOUND for public
 * hosts (including *.supabase.co). Node's fetch uses dns.lookup / getaddrinfo,
 * so login then hangs even though the browser can resolve the same name.
 */
if (global.__sitepilotDnsPatched) {
  module.exports = {}
} else {
  global.__sitepilotDnsPatched = true

  const dns = require('dns')
  const originalLookup = dns.lookup.bind(dns)
  const fallback = new dns.Resolver()
  fallback.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4'])

  function isTransientDns(err) {
    return err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN' || err.code === 'ETIMEOUT')
  }

  function lookupWithFallback(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    if (!callback) {
      return originalLookup(hostname, options)
    }
    options = options || {}

    const tryOriginal = (attempt) => {
      originalLookup(hostname, options, (err, address, family) => {
        if (!err) {
          callback(err, address, family)
          return
        }
        if (!isTransientDns(err) || attempt >= 3) {
          fallback.resolve4(hostname, (fbErr, addresses) => {
            if (fbErr || !addresses || addresses.length === 0) {
              callback(err, address, family)
              return
            }
            if (options.all) {
              callback(null, addresses.map((item) => ({ address: item, family: 4 })))
              return
            }
            callback(null, addresses[0], 4)
          })
          return
        }
        setTimeout(() => tryOriginal(attempt + 1), 80 * attempt)
      })
    }

    tryOriginal(1)
  }

  dns.lookup = lookupWithFallback
  if (dns.promises) {
    dns.promises.lookup = (hostname, options) =>
      new Promise((resolve, reject) => {
        lookupWithFallback(hostname, options || {}, (err, address, family) => {
          if (err) reject(err)
          else if (options && options.all) resolve(address)
          else resolve({ address, family })
        })
      })
  }

  module.exports = {}
}
