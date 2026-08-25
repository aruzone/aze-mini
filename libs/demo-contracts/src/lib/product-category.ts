/** A category a Product belongs to. */
export type ProductCategory = {
  id: number;
  name: string;
};

/** The body `POST /product-category` accepts. */
export type CreateProductCategoryRequest = {
  name: string;
};

/** The body `PATCH /product-category/:id` accepts. */
export type UpdateProductCategoryRequest = Partial<CreateProductCategoryRequest>;
