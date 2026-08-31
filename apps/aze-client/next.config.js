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
  // The Content-Security-Policy is not here: it carries a per-request nonce,
  // so `src/middleware.ts` mints it and sets the header on every page it
  // matches. A second static policy set here would be enforced alongside it
  // and could only ever contradict it.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
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
