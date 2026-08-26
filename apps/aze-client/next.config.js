//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},

  // A self-contained server plus only the node_modules it actually reaches,
  // so the runtime image carries no npm install of its own. See
  // apps/aze-client/Dockerfile.
  output: 'standalone',

  // The client serves the HTML, so this is where framing and sniffing actually
  // matter — the API's own headers (src/config/security-headers.ts) protect a
  // JSON body nobody renders.
  //
  // The Content-Security-Policy here is deliberately partial. `frame-ancestors`,
  // `base-uri` and `object-src` need nothing from the page to be safe. A
  // `script-src` strict enough to be worth having needs a per-request nonce
  // threaded through the App Router, which is a real piece of work and a
  // decision about how you render — so it is left to you rather than guessed
  // at here. docs/deployment.md says so too.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=15552000; includeSubDomains',
          },
          // Nothing here asks for any of them.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
