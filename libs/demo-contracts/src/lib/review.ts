/** A review of one Product. */
export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  productId: string;
  createdAt: Date;
};

/** The body `POST /review` accepts. */
export type CreateReviewRequest = {
  rating: number;
  comment?: string;
  productId: string;
};

/** The body `PATCH /review/:id` accepts. */
export type UpdateReviewRequest = Partial<CreateReviewRequest>;
