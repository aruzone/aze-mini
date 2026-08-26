#!/usr/bin/env node
// Documentation that describes code drifts away from it silently. This is what
// stops that: it fails when a document names a file that is not there, points
// at a line number, or describes a route the API does not serve.
//
// Run it with `npm run check:docs`. CI runs it on every pull request.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.nx',
  'dist',
  'coverage',
  '.next',
  'generated',
  'test-output',
  'playwright-report',
]);

// Paths a document may name that are not in the repository: generated at build
// time, or named as the thing that does not exist yet.
const ALLOWED_MISSING = new Set([
  'CONTEXT-MAP.md',
  // Tailwind v4 is configured from CSS; the documents say this file is absent.
  'tailwind.config.js',
  // The GitHub repository, which is not a path in it.
  'aruzone/aze-mini',
  'apps/aze-api/generated/prisma/',
  'apps/aze-api/generated/prisma',
  'apps/aze-api/.env',
  '.env',
]);

const FILE_EXTENSIONS =
  /\.(ts|tsx|js|jsx|mjs|cjs|json|prisma|ya?ml|md|css|html|sql|example|png|svg|tpl|txt)$/;

const problems = [];
const report = (file, message) => problems.push(`${file}: ${message}`);

function walk(dir, out = { files: [], dirs: [] }) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.dirs.push(relative(ROOT, path));
      walk(path, out);
    } else {
      out.files.push(relative(ROOT, path));
    }
  }
  return out;
}

const tree = walk(ROOT);
// The dotfiles the walk skips but a document may still name.
tree.files.push('.nvmrc', '.editorconfig', 'apps/aze-api/.env.example');
const everything = new Set([...tree.files, ...tree.dirs]);

/** A document may name a file by its tail — `guards/auth.guard.ts` — so match on
 *  a whole-segment suffix rather than requiring the path from the root. */
function exists(token) {
  const clean = token.replace(/^\.\//, '').replace(/\/$/, '');
  if (!clean || ALLOWED_MISSING.has(token) || ALLOWED_MISSING.has(clean))
    return true;
  if (everything.has(clean)) return true;
  const tail = `${sep === '/' ? '/' : '/'}${clean}`;
  for (const path of everything) if (path.endsWith(tail)) return true;
  return false;
}

/** Fenced blocks hold directory sketches and worked examples, which name paths
 *  that are deliberately hypothetical. Only prose is checked. */
const withoutFences = (text) => text.replace(/^```[\s\S]*?^```/gm, '');

const markdownFiles = tree.files.filter((path) => path.endsWith('.md'));

for (const file of markdownFiles) {
  const raw = readFileSync(join(ROOT, file), 'utf8');
  const prose = withoutFences(raw);

  // Links to something in this repository have to resolve from the document.
  for (const [, , target] of prose.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = target.split('#')[0];
    if (!path) continue;
    const resolved = relative(ROOT, resolve(ROOT, dirname(file), path));
    if (!exists(resolved)) report(file, `link to a missing path: ${target}`);
  }

  // A path in backticks has to name something real.
  for (const [, token] of prose.matchAll(/`([^`\n]+)`/g)) {
    if (/[\s'"(){}<>*=,;:!?]/.test(token)) continue;
    // Package names, routes, URLs, import specifiers and build output are
    // all path-shaped without being paths in the repository.
    if (/^(@|\/|https?|\.\.\/|dist\/)/.test(token)) continue;
    const looksLikeAPath = token.includes('/') || FILE_EXTENSIONS.test(token);
    if (!looksLikeAPath) continue;
    if (!exists(token))
      report(file, `names a path that does not exist: ${token}`);
  }

  // Line numbers are the fastest thing in a document to go stale, and nothing
  // reading it can tell that it has.
  for (const [, ref] of prose.matchAll(/`([^`\n]*\.[a-z]+:\d+)`/g)) {
    report(
      file,
      `points at a line number, which drifts: ${ref}. Name the file alone`,
    );
  }
}

// ---------------------------------------------------------------------------
// The routes docs/interfaces.md documents, against the routes the API serves.
// ---------------------------------------------------------------------------

const ROUTE_DECORATOR =
  /^\s*@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?\s*\)/;
const GUARDS = { Public: 'None', MachineToMachine: 'API key' };

function routesInController(file) {
  const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
  const prefix =
    lines.join('\n').match(/@Controller\(\s*(?:'([^']*)')?\s*\)/)?.[1] ?? '';
  const routes = [];

  lines.forEach((line, index) => {
    const match = line.match(ROUTE_DECORATOR);
    if (!match) return;

    // The decorators stacked immediately above say which guard answers for it.
    let guard = 'JWT';
    for (
      let above = index - 1;
      above >= 0 && lines[above].trim().startsWith('@');
      above--
    ) {
      const name = lines[above].trim().match(/^@(\w+)/)?.[1];
      if (name && GUARDS[name]) guard = GUARDS[name];
    }

    const segments = ['api', prefix, match[2] ?? ''].filter(Boolean);
    routes.push({
      method: match[1].toUpperCase(),
      path: `/${segments.join('/')}`,
      guard,
    });
  });

  return routes;
}

const controllers = tree.files.filter((path) =>
  path.endsWith('.controller.ts'),
);
const served = new Map();
for (const file of controllers) {
  for (const route of routesInController(file)) {
    served.set(`${route.method} ${route.path}`, { ...route, file });
  }
}

const INTERFACES = 'docs/interfaces.md';
if (!markdownFiles.includes(INTERFACES)) {
  report(
    INTERFACES,
    'is missing — it is what this check compares the API against',
  );
} else {
  const documented = new Map();
  const table =
    /\|\s*`(GET|POST|PATCH|PUT|DELETE) (\/api[^`\s]*)`\s*\|\s*([^|]+?)\s*\|/g;
  for (const [, method, path, guard] of readFileSync(
    join(ROOT, INTERFACES),
    'utf8',
  ).matchAll(table)) {
    documented.set(`${method} ${path}`, guard);
  }

  for (const [route, { guard, file }] of served) {
    if (!documented.has(route)) {
      report(INTERFACES, `does not document ${route}, which ${file} serves`);
    } else if (documented.get(route) !== guard) {
      report(
        INTERFACES,
        `says ${route} is guarded by "${documented.get(route)}"; ${file} answers it with "${guard}"`,
      );
    }
  }

  for (const route of documented.keys()) {
    if (!served.has(route))
      report(INTERFACES, `documents ${route}, which no controller serves`);
  }
}

if (problems.length > 0) {
  console.error(
    `Documentation does not match the code (${problems.length}):\n`,
  );
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(
  `Documentation matches the code: ${markdownFiles.length} documents, ${served.size} routes.`,
);
