import { Wire } from './wire';

type Equals<A, B> = (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B
  ? 1
  : 2
  ? true
  : false;

/**
 * A type-level assertion, spelled as a call so it runs. Nothing about `Wire`
 * exists at runtime, so a mapping that stopped reaching into arrays or optional
 * fields would fail here at compile time and nowhere else — the `expect` below
 * is only what makes that failure part of a test run.
 */
const typeHolds = <_Check extends true>() => true;

type Row = {
  id: string;
  price: number;
  createdAt: Date;
  archivedAt?: Date;
  reviews: { comment: string | null; createdAt: Date }[];
};

describe('Wire', () => {
  it('reads a date as the string JSON delivers', () => {
    expect(typeHolds<Equals<Wire<Row>['createdAt'], string>>()).toBe(true);
  });

  it('reaches into the rows nested inside a contract', () => {
    expect(
      typeHolds<
        Equals<Wire<Row>['reviews'], { comment: string | null; createdAt: string }[]>
      >(),
    ).toBe(true);
  });

  it('leaves a field optional that was optional', () => {
    expect(typeHolds<Equals<Wire<Row>['archivedAt'], string | undefined>>()).toBe(true);
  });

  it('leaves alone what JSON carries unchanged', () => {
    expect(typeHolds<Equals<Wire<Row>['id'], string>>()).toBe(true);
    expect(typeHolds<Equals<Wire<Row>['price'], number>>()).toBe(true);
  });

  // The assertions above are claims about a real payload; this is the payload.
  it('describes what a caller actually receives', () => {
    const row: Row = {
      id: 'a',
      price: 9.99,
      createdAt: new Date('2026-08-25T09:00:00.000Z'),
      reviews: [{ comment: null, createdAt: new Date('2026-08-25T10:00:00.000Z') }],
    };

    const delivered: Wire<Row> = JSON.parse(JSON.stringify(row));

    expect(delivered.createdAt).toBe('2026-08-25T09:00:00.000Z');
    expect(delivered.reviews[0].createdAt).toBe('2026-08-25T10:00:00.000Z');
    expect(delivered.archivedAt).toBeUndefined();
  });
});
