/** The order `GET /products` reads the catalogue in. */
export type ProductSort = 'asc' | 'desc';

/** A catalogue entry, as the products routes answer with it. */
export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The body `POST /products` accepts. Relations cross as flat ids — the service
 * is what turns them into Prisma's nested `connect` — so nothing generated from
 * the schema reaches the wire.
 */
export type CreateProductRequest = {
  name: string;
  description?: string;
  price: number;
  categoryId: number;
  /** The Tags to link. An update sends the full set: it replaces rather than adds. */
  tagIds?: string[];
};

/** The body `PATCH /products/:id` accepts. */
export type UpdateProductRequest = Partial<CreateProductRequest>;
