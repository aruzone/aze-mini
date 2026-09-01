import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appConfig, configurationProblems } from './configuration';

describe('appConfig', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.NODE_ENV;
    delete process.env.API_DOCS;
    delete process.env.REDIS_URL;
    delete process.env.CORS_ORIGIN;
    delete process.env.TRUST_PROXY;
    delete process.env.AUDIT_RETENTION_MONTHS;
  });

  afterAll(() => {
    process.env = original;
  });

  // The compose file publishes Redis on the default port, so a clone that
  // follows the setup has one without configuring anything.
  describe('redisUrl', () => {
    it('points at the compose service when nothing says otherwise', () => {
      expect(appConfig().redisUrl).toBe('redis://localhost:6379');
    });

    it('takes the environment over the default', () => {
      process.env.REDIS_URL = 'redis://cache.internal:6379';

      expect(appConfig().redisUrl).toBe('redis://cache.internal:6379');
    });
  });

  // Hardcoded to localhost, the origin was wrong the moment anyone deployed,
  // and wrong in a way only a code change could fix.
  describe('corsOrigins', () => {
    it('allows the client a local clone starts when nothing says otherwise', () => {
      expect(appConfig().corsOrigins).toEqual(['http://localhost:3000']);
    });

    it('takes the origin from the environment', () => {
      process.env.CORS_ORIGIN = 'https://app.example.com';

      expect(appConfig().corsOrigins).toEqual(['https://app.example.com']);
    });

    // A front end and a docs page on separate hosts are two origins, and an
    // Adopter should not have to choose one.
    it('accepts several, separated by commas', () => {
      process.env.CORS_ORIGIN = 'https://app.example.com, https://admin.example.com';

      expect(appConfig().corsOrigins).toEqual([
        'https://app.example.com',
        'https://admin.example.com',
      ]);
    });

    it('ignores the empty entries a trailing comma leaves', () => {
      process.env.CORS_ORIGIN = 'https://app.example.com,,';

      expect(appConfig().corsOrigins).toEqual(['https://app.example.com']);
    });

    // Set but blank is a compose file declaring the variable and leaving it
    // empty, which must not mean "no origin at all".
    it('falls back when the variable is set but blank', () => {
      process.env.CORS_ORIGIN = '   ';

      expect(appConfig().corsOrigins).toEqual(['http://localhost:3000']);
    });

    // The one value that cannot be a mistake to read literally: it means any
    // origin, and the deployment checklist says what that costs.
    it('passes a wildcard through as itself', () => {
      process.env.CORS_ORIGIN = '*';

      expect(appConfig().corsOrigins).toBe('*');
    });
  });

  // Login is throttled per source address, and behind a proxy every request
  // arrives from the proxy. Trusting the forwarding header fixes that and
  // makes it spoofable, so it is a decision rather than a default.
  describe('trustProxy', () => {
    it('trusts nothing by default', () => {
      expect(appConfig().trustProxy).toBe(false);
    });

    it('takes a hop count when given one', () => {
      process.env.TRUST_PROXY = '1';

      expect(appConfig().trustProxy).toBe(1);
    });

    it('takes a named or literal value as it stands', () => {
      process.env.TRUST_PROXY = 'loopback';

      expect(appConfig().trustProxy).toBe('loopback');
    });

    it('reads true as trusting the header outright', () => {
      process.env.TRUST_PROXY = 'true';

      expect(appConfig().trustProxy).toBe(true);
    });
  });

  describe('docsEnabled', () => {
    it('serves the docs in development', () => {
      expect(appConfig().docsEnabled).toBe(true);
    });

    // An Adopter who deploys without thinking about it does not publish a map
    // of every route and body shape.
    it('withholds them in production by default', () => {
      process.env.NODE_ENV = 'production';

      expect(appConfig().docsEnabled).toBe(false);
    });

    it('serves them in production when asked to', () => {
      process.env.NODE_ENV = 'production';
      process.env.API_DOCS = 'true';

      expect(appConfig().docsEnabled).toBe(true);
    });

    it('withholds them anywhere when refused', () => {
      process.env.NODE_ENV = 'development';
      process.env.API_DOCS = 'false';

      expect(appConfig().docsEnabled).toBe(false);
    });

    // A compose file that declares API_DOCS and leaves it blank passes an
    // empty string, not an absent variable.
    it.each([['yes'], [''], ['TRUE'], ['1']])(
      'treats %p as a refusal, since only "true" is consent',
      (value) => {
        process.env.API_DOCS = value;

        expect(appConfig().docsEnabled).toBe(false);
      },
    );
  });

  // Every consumer reads the secrets through these keys. A consumer that
  // reaches past them to process.env would still be reading a value nothing
  // has judged.
  describe('secrets', () => {
    it('carries the signing secret and the API key', () => {
      process.env.JWT_SECRET = 'a-real-secret';
      process.env.API_KEY = 'a-real-key';

      expect(appConfig()).toMatchObject({
        jwtSecret: 'a-real-secret',
        apiKey: 'a-real-key',
      });
    });

    it('invents no signing secret when none was configured', () => {
      delete process.env.JWT_SECRET;

      expect(appConfig().jwtSecret).toBeUndefined();
    });

    // A quoted value in .env keeps its padding. The header it is compared
    // against does not, so the two would never match.
    it('carries what was checked, not what was quoted', () => {
      process.env.JWT_SECRET = '  a-real-secret  ';
      process.env.API_KEY = '  a-real-key  ';

      expect(appConfig()).toMatchObject({
        jwtSecret: 'a-real-secret',
        apiKey: 'a-real-key',
      });
    });
  });

  describe('auditRetentionMonths', () => {
    it('keeps twelve months by default', () => {
      expect(appConfig().auditRetentionMonths).toBe(12);
    });

    it('takes a positive whole month count from the environment', () => {
      process.env.AUDIT_RETENTION_MONTHS = '24';

      expect(appConfig().auditRetentionMonths).toBe(24);
    });
  });
});

describe('an optional variable nobody can act on', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original, DATABASE_URL: 'postgres://x', JWT_SECRET: 's', API_KEY: 'k' };
    delete process.env.TRUST_PROXY;
  });

  afterAll(() => {
    process.env = original;
  });

  it('is no problem when it is simply absent', () => {
    expect(configurationProblems()).toEqual([]);
  });

  // Express throws on a `trust proxy` it cannot parse, from somewhere that
  // names no variable. This is the one place that says which one is wrong.
  it('names TRUST_PROXY when it holds something meaningless', () => {
    process.env.TRUST_PROXY = 'yes please';

    expect(configurationProblems()).toEqual([expect.stringContaining('TRUST_PROXY')]);
  });

  it.each(['1', '0', 'true', 'false', 'loopback', '10.0.0.0/8'])(
    'accepts %s',
    (value) => {
      process.env.TRUST_PROXY = value;

      expect(configurationProblems()).toEqual([]);
    },
  );
});

describe('configurationProblems', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
    process.env.DATABASE_URL = 'postgresql://aze@localhost:5432/aze';
    process.env.JWT_SECRET = 'a-real-secret';
    process.env.API_KEY = 'a-real-key';
  });

  afterAll(() => {
    process.env = original;
  });

  it('finds nothing wrong with a configured environment', () => {
    expect(configurationProblems()).toEqual([]);
  });

  it.each([['DATABASE_URL'], ['JWT_SECRET'], ['API_KEY']])(
    'names %s when it is absent',
    (variable) => {
      delete process.env[variable];

      expect(configurationProblems()).toEqual([
        `${variable} is not set. See apps/aze-api/.env.example.`,
      ]);
    },
  );

  // An Adopter fixes the whole file in one pass rather than restarting once
  // per variable.
  it('names every absent variable at once', () => {
    delete process.env.JWT_SECRET;
    delete process.env.API_KEY;

    expect(configurationProblems()).toHaveLength(2);
  });

  // A compose file that declares a variable and leaves it blank passes an
  // empty string, not an absent variable.
  it.each([[''], ['   ']])('treats %p as absent', (value) => {
    process.env.JWT_SECRET = value;

    expect(configurationProblems()).toEqual([
      'JWT_SECRET is not set. See apps/aze-api/.env.example.',
    ]);
  });

  it('rejects the placeholder shape the example file ships', () => {
    process.env.JWT_SECRET = 'your_jwt_secret_here';

    expect(configurationProblems()).toEqual([
      'JWT_SECRET is still the placeholder from .env.example. Replace it.',
    ]);
  });

  it('rejects a partial audit retention value', () => {
    process.env.AUDIT_RETENTION_MONTHS = '12months';

    expect(configurationProblems()).toEqual([
      'AUDIT_RETENTION_MONTHS is "12months", which is not a positive whole number. See apps/aze-api/.env.example.',
    ]);
  });

  // The example file is the thing an Adopter copies, so it is the thing the
  // rule has to be right about — not a copy of its values kept here.
  describe('the shipped .env.example', () => {
    const example = Object.fromEntries(
      readFileSync(join(__dirname, '../../.env.example'), 'utf8')
        .split('\n')
        .filter((line) => line.trim() && !line.trim().startsWith('#'))
        .map((line) => {
          const [name, ...rest] = line.split('=');
          return [name.trim(), rest.join('=').trim().replace(/^"|"$/g, '')];
        }),
    );

    it('cannot boot when copied untouched', () => {
      process.env = { ...original, ...example };

      expect(configurationProblems()).toEqual([
        'JWT_SECRET is still the placeholder from .env.example. Replace it.',
        'API_KEY is still the placeholder from .env.example. Replace it.',
      ]);
    });

    // The connection string it ships is the real local one, matching the
    // compose file. Rejecting it would break the documented setup.
    it('ships a usable DATABASE_URL', () => {
      process.env = { ...original, ...example };
      process.env.JWT_SECRET = 'a-real-secret';
      process.env.API_KEY = 'a-real-key';

      expect(configurationProblems()).toEqual([]);
    });
  });
});
