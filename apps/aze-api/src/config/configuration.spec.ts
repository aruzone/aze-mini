import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appConfig, configurationProblems } from './configuration';

describe('appConfig', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.NODE_ENV;
    delete process.env.API_DOCS;
  });

  afterAll(() => {
    process.env = original;
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
