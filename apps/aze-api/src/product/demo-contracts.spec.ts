import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DEMO_CONTRACTS = '@aze-mini/demo-contracts';
const PRODUCT_DIR = __dirname;
const API_SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

const reachesDemoContracts = (path: string) =>
  readFileSync(path, 'utf8').includes(DEMO_CONTRACTS);

/** Relative, so a failure names the file rather than this machine's home dir. */
const readably = (paths: string[]) => paths.map((path) => relative(API_SRC, path));

// Removing the Demo is meant to be a delete, not an edit: `docs/demo.md` says
// to drop `src/product/` and the Demo contracts package together. That only
// holds while every reference to those contracts lives inside the directory
// that goes with them, which is what this checks. It is Demo itself, and is
// deleted along with the rest of this directory.
describe('the Demo contracts', () => {
  it('are what every Demo request body is declared against', () => {
    const dtos = sourceFiles(PRODUCT_DIR).filter((path) => path.endsWith('.dto.ts'));

    expect(dtos.length).toBeGreaterThan(0);
    expect(readably(dtos.filter((path) => !reachesDemoContracts(path)))).toEqual([]);
  });

  it('are reached from nowhere the Platform keeps', () => {
    const outside = sourceFiles(API_SRC).filter(
      (path) => !path.startsWith(PRODUCT_DIR + sep),
    );

    expect(readably(outside.filter(reachesDemoContracts))).toEqual([]);
  });
});
