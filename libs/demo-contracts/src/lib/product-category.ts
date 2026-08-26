/** A category a Product belongs to. */
export type ProductCategory = {
  id: number;
  name: string;
};

/** The body `POST /categories` accepts. */
export type CreateProductCategoryRequest = {
  name: string;
};

/** The body `PATCH /categories/:id` accepts. */
export type UpdateProductCategoryRequest = Partial<CreateProductCategoryRequest>;
