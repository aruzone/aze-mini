import type { RequestHandler } from 'express';
import helmet, { type HelmetOptions } from 'helmet';

/**
 * Most of what Helmet sets is aimed at HTML a browser will render, and this API
 * answers JSON. It is all set anyway: the cost is a few bytes, and the one
 * response that *is* rendered — the documentation page — is the one an attacker
 * would most like to frame or inject into.
 */
const STRICT: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      // Nothing here is meant to be framed, and this is what a modern browser
      // reads instead of X-Frame-Options.
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      // Left to the deployment: a local clone has no TLS, so upgrading every
      // request to HTTPS would break it before an Adopter saw it work.
      upgradeInsecureRequests: null,
    },
  },

  // Reach this origin over HTTPS for the next six months. Deliberately not
  // preloaded: preloading is close to irreversible and is a decision about a
  // domain, which belongs to the Adopter rather than to us.
  strictTransportSecurity: {
    maxAge: 180 * 24 * 60 * 60,
    includeSubDomains: true,
    preload: false,
  },

  // The default `no-referrer` also strips the header from same-origin
  // navigation, where it is useful and harmless.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // Off: it sends `Cross-Origin-Resource-Policy: same-origin`, and an API whose
  // purpose is to answer another origin should not refuse to be read by one.
  // Which origins may is decided by CORS, from the environment.
  crossOriginResourcePolicy: false,

  // Swagger UI would be refused by the default `require-corp`, and the
  // documentation is the only HTML this API serves.
  crossOriginEmbedderPolicy: false,
};

/**
 * What the documentation page needs, and nothing else gets. Swagger UI builds
 * its markup and styles inline; a JSON API never does, so the strict policy
 * stays everywhere it matters.
 */
const FOR_DOCS: HelmetOptions = {
  ...STRICT,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
};

/**
 * The security headers every response carries. `docsPath`, when the docs are
 * being served, is the one prefix that gets the looser policy — passing it in
 * rather than reading config here keeps this a pure statement of the policy.
 */
export function securityHeaders(docsPath?: string): RequestHandler {
  const strict = helmet(STRICT);
  const forDocs = helmet(FOR_DOCS);
  const docsPrefix = docsPath ? `/${docsPath}` : undefined;

  return (req, res, next) => {
    const isDocs = docsPrefix !== undefined && req.path.startsWith(docsPrefix);
    return (isDocs ? forDocs : strict)(req, res, next);
  };
}
