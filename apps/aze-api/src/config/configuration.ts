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

  const level = process.env.LOG_LEVEL?.trim();
  if (level && !(LOG_LEVELS as readonly string[]).includes(level)) {
    problems.push(
      `LOG_LEVEL is "${level}", which is not one of: ${LOG_LEVELS.join(', ')}. See apps/aze-api/.env.example.`,
    );
  }

  // The token lifetimes, the throttle ceilings and the mail origin are
  // positive whole numbers of seconds / requests when given. A duration a
  // deployment half-writes ("900s") would otherwise fall back to its default
  // silently and run with lifetimes nobody chose.
  for (const [name, value] of Object.entries({
    ACCESS_TOKEN_TTL_SECONDS: process.env.ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_TTL_SECONDS: process.env.REFRESH_TOKEN_TTL_SECONDS,
    REFRESH_IDLE_TTL_SECONDS: process.env.REFRESH_IDLE_TTL_SECONDS,
    THROTTLE_PER_MINUTE: process.env.THROTTLE_PER_MINUTE,
    REGISTRATIONS_PER_MINUTE: process.env.REGISTRATIONS_PER_MINUTE,
    EMAIL_RESET_TTL_SECONDS: process.env.EMAIL_RESET_TTL_SECONDS,
    EMAIL_VERIFICATION_TTL_SECONDS: process.env.EMAIL_VERIFICATION_TTL_SECONDS,
    AUDIT_RETENTION_MONTHS: process.env.AUDIT_RETENTION_MONTHS,
  })) {
    if (value !== undefined && (!/^\d+$/.test(value.trim()) || Number(value) <= 0)) {
      problems.push(
        `${name} is "${value}", which is not a positive whole number. See apps/aze-api/.env.example.`,
      );
    }
  }

  return problems;
};

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

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

/**
 * A positive whole number from the environment, or the default when unset.
 * The values this reads were validated at startup, so a malformed one never
 * reaches here in a process that booted.
 */
function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? NaN : Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

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
    // Structured logs go to stdout as JSON; this only decides how much of
    // them. Validated above, so a typo says so at startup instead of logging
    // everything at the default and looking broken.
    logLevel: process.env.LOG_LEVEL?.trim() || 'info',
    // The metrics endpoint names routes and carries process internals, so it
    // is opt-in like API_DOCS rather than on by default: unset means off,
    // and the exact string "true" turns it on.
    // The token lifecycle (ADR-0009): how long an access token lives, how long
    // a refresh chain may exist at all, and how long it may sit unused.
    accessTokenTtlSeconds: positiveInt(process.env.ACCESS_TOKEN_TTL_SECONDS, 15 * 60),
    refreshTokenTtlSeconds: positiveInt(process.env.REFRESH_TOKEN_TTL_SECONDS, 30 * 24 * 60 * 60),
    refreshIdleTtlSeconds: positiveInt(process.env.REFRESH_IDLE_TTL_SECONDS, 7 * 24 * 60 * 60),
    // Throttling (ADR-0010): the perimeter default per source per minute, and
    // the tighter ceiling registration alone answers to.
    throttlePerMinute: positiveInt(process.env.THROTTLE_PER_MINUTE, 100),
    registrationsPerMinute: positiveInt(process.env.REGISTRATIONS_PER_MINUTE, 5),
    // Where the email flows (ADR-0011) point their links. Configured rather
    // than taken from the request's Host header, which a caller supplies and
    // so could point the reset link at their own host (OWASP host-header
    // injection). Defaults to the client a local clone starts.
    appOrigin: process.env.APP_ORIGIN?.trim() || 'http://localhost:3000',
    // Outbound mail. Unset — or anything outside production — and the mail
    // sender writes into the JSON log instead, so local development needs no
    // SMTP server (ADR-0011).
    smtpUrl: process.env.SMTP_URL?.trim(),
    // The email token lifetimes (ADR-0011): how long a reset link and a
    // verification link stay valid.
    emailResetTtlSeconds: positiveInt(process.env.EMAIL_RESET_TTL_SECONDS, 60 * 60),
    emailVerificationTtlSeconds: positiveInt(
      process.env.EMAIL_VERIFICATION_TTL_SECONDS,
      24 * 60 * 60,
    ),
    // Audit partitions older than this many calendar months are eligible for
    // the documented drop operation (ADR-0012). The API does not schedule it.
    auditRetentionMonths: positiveInt(process.env.AUDIT_RETENTION_MONTHS, 12),
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
  };
};
