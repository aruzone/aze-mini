// Without these the Starter either cannot reach its database or cannot tell a
// real credential from any other string, so it refuses to start rather than
// failing on the first request that needs one.
const REQUIRED_VARIABLES = ['DATABASE_URL', 'JWT_SECRET', 'API_KEY'] as const;

// The shape .env.example ships its secrets in. Matching one means the file was
// copied and never edited.
const PLACEHOLDER = /^your_.*_here$/;

export const configurationProblems = (): string[] =>
  REQUIRED_VARIABLES.flatMap((name) => {
    const value = process.env[name]?.trim();

    if (!value) {
      return `${name} is not set. See apps/aze-api/.env.example.`;
    }
    if (PLACEHOLDER.test(value)) {
      return `${name} is still the placeholder from .env.example. Replace it.`;
    }
    return [];
  });

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
    docsEnabled:
      process.env.API_DOCS === undefined
        ? environment !== 'production'
        : process.env.API_DOCS === 'true',
  };
};
