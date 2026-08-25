/** A tag, linked to any number of Products. */
export type Tag = {
  id: string;
  name: string;
};

/** The body `POST /tag` accepts. */
export type CreateTagRequest = {
  name: string;
  /** The Products to link. An update sends the full set: it replaces rather than adds. */
  productIds?: string[];
};

/** The body `PATCH /tag/:id` accepts. */
export type UpdateTagRequest = Partial<CreateTagRequest>;
