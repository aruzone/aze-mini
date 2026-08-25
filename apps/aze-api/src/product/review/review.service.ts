import { Review } from '@aze-mini/demo-contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { DatabaseService } from '../../database/database.service';
import { RECORD_NOT_FOUND, isPrismaError } from '../../database/prisma-errors';

@Injectable()
export class ReviewService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createReviewDto: CreateReviewDto): Promise<Review> {
    const { productId, ...review } = createReviewDto;
    try {
      return await this.databaseService.review.create({
        data: { ...review, product: { connect: { id: productId } } },
      });
    } catch (error) {
      await this.nameMissingRelation(error, productId);
      throw error;
    }
  }

  findAll(): Promise<Review[]> {
    return this.databaseService.review.findMany();
  }

  async findOne(id: string): Promise<Review> {
    const review = await this.databaseService.review.findUnique({
      where: { id },
    });
    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }
    return review;
  }

  async update(id: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
    const { productId, ...review } = updateReviewDto;
    try {
      return await this.databaseService.review.update({
        where: { id },
        data: {
          ...review,
          ...(productId !== undefined && { product: { connect: { id: productId } } }),
        },
      });
    } catch (error) {
      await this.nameMissingRelation(error, productId);
      throw error;
    }
  }

  remove(id: string): Promise<Review> {
    return this.databaseService.review.delete({ where: { id } });
  }

  // Prisma reports a failed connect as P2025 naming the relation, never the id
  // that missed. The lookup runs after the write has already failed, so only a
  // request that named a bad id pays for the answer.
  private async nameMissingRelation(error: unknown, productId?: string) {
    if (!isPrismaError(error, RECORD_NOT_FOUND) || productId === undefined) {
      return;
    }

    const product = await this.databaseService.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }
  }
}
