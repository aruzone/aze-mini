// Without these the Starter either cannot reach its database or cannot tell a
// real credential from any other string, so it refuses to start rather than
// failing on the first request that needs one.
const REQUIRED_VARIABLES = ['DATABASE_URL', 'JWT_SECRET', 'API_KEY'] as const;

// The shape .env.example ships its secrets in. Matching one means the file was
// copied and never edited.
const PLACEHOLDER = /^your_.*_here$/;

export const configurationProblems = (): string[] => [
  ...REQUIRED_VARIABLES.flatMap((name) => {
    const value = process.env[name]?.trim();

    if (!value) {
      return `${name} is not set. See apps/aze-api/.env.example.`;
    }
    if (PLACEHOLDER.test(value)) {
      return `${name} is still the placeholder from .env.example. Replace it.`;
    }
    return [];
  }),
  ...optionalVariableProblems(),
];

// These have working defaults, so an absent one is no problem at all. A value
// that cannot be understood is a different thing: Express throws on an
// unparseable `trust proxy` from somewhere that names nothing, and a `*` origin
// asked to carry credentials fails in the browser rather than here. Both are
// said in the one place that says which variable is wrong.
const optionalVariableProblems = (): string[] => {
  const problems: string[] = [];

  const trust = process.env.TRUST_PROXY?.trim();
  if (trust && !isUnderstoodTrustProxy(trust)) {
    problems.push(
      `TRUST_PROXY is "${trust}", which is not a number of hops, true, false, or an address. See apps/aze-api/.env.example.`,
    );
  }

  return problems;
};

const TRUST_PROXY_NAMES = ['true', 'false', 'loopback', 'linklocal', 'uniquelocal'];

const isUnderstoodTrustProxy = (value: string): boolean => {
  if (TRUST_PROXY_NAMES.includes(value)) {
    return true;
  }
  const hops = Number(value);
  if (Number.isInteger(hops) && hops >= 0) {
    return true;
  }
  // Anything else has to look like an address or a subnet, which is the only
  // other thing Express accepts. A bare word does not.
  return /^[0-9a-fA-F.:/,\s]+$/.test(value);
};

/** The client a local clone starts, and the only origin allowed until asked. */
const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

/**
 * Which origins a browser may call the API from. Several are allowed, comma
 * separated — a front end and a docs page on separate hosts are two origins.
 *
 * `*` passes through as itself: it is the one value that cannot be a mistake to
 * read literally, and `docs/deployment.md` says what allowing it costs.
 */
const corsOrigins = (): string | string[] => {
  const configured = process.env.CORS_ORIGIN?.trim();
  if (!configured) {
    return [DEFAULT_CORS_ORIGIN];
  }
  if (configured === '*') {
    return '*';
  }

  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // A variable holding only commas said nothing, and answering with an empty
  // list would refuse every origin including the local one.
  return origins.length > 0 ? origins : [DEFAULT_CORS_ORIGIN];
};

/**
 * What Express should believe about `X-Forwarded-For`. Login is throttled per
 * source address, and behind a proxy every request arrives from the proxy —
 * so untrusted, one bucket serves everyone and one attacker locks out the lot.
 *
 * Trusting it blindly is the opposite mistake: the header is caller-supplied,
 * and an attacker who can set it has as many identities as they like. Hence a
 * hop count — the number of proxies actually in front of this — rather than a
 * boolean anyone would default to true.
 */
const trustProxy = (): boolean | number | string => {
  const configured = process.env.TRUST_PROXY?.trim();
  if (!configured) {
    return false;
  }
  if (configured === 'true') {
    return true;
  }
  if (configured === 'false') {
    return false;
  }

  const hops = Number(configured);
  return Number.isInteger(hops) && hops >= 0 ? hops : configured;
};

export const appConfig = () => {
  const environment = process.env.NODE_ENV || 'development';

  return {
    port: parseInt(process.env.PORT || '3030', 10),
    // Trimmed to the same string the check above judged. A quoted `" abc "` in
    // .env otherwise passes the check and then never matches an x-api-key
    // header, which arrives with its surrounding whitespace already stripped.
    // Deliberately undefined when unset: nothing here supplies a fallback
    // secret, so a Starter that boots is one someone configured.
    jwtSecret: process.env.JWT_SECRET?.trim(),
    apiKey: process.env.API_KEY?.trim(),
    environment,
    // Defaulted rather than demanded: the cache fails open (ADR-0005), so an
    // Adopter who has not started Redis gets a slower Starter, not a broken one.
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    // The docs describe every route and the shape of every body, which is a map
    // an Adopter may not want to publish. Off in production unless asked for,
    // on everywhere else unless refused.
    corsOrigins: corsOrigins(),
    trustProxy: trustProxy(),
    docsEnabled:
      process.env.API_DOCS === undefined
        ? environment !== 'production'
        : process.env.API_DOCS === 'true',
  };
};
