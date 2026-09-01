import { Review } from '@aze-mini/demo-contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { DatabaseService } from '../../database/database.service';
import { RECORD_NOT_FOUND, isPrismaError } from '../../database/prisma-errors';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ReviewService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async create(createReviewDto: CreateReviewDto, actorUserId: string): Promise<Review> {
    const { productId, ...review } = createReviewDto;
    try {
      return await this.databaseService.$transaction(async (tx) => {
        const result = await tx.review.create({
          data: { ...review, product: { connect: { id: productId } } },
        });
        await this.audit.append(tx, {
          event: 'review.created',
          actorUserId,
          subjectType: 'Review',
          subjectId: result.id,
        });
        return result;
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

  async update(
    id: string,
    updateReviewDto: UpdateReviewDto,
    actorUserId: string,
  ): Promise<Review> {
    const { productId, ...review } = updateReviewDto;
    try {
      return await this.databaseService.$transaction(async (tx) => {
        const result = await tx.review.update({
          where: { id },
          data: {
            ...review,
            ...(productId !== undefined && {
              product: { connect: { id: productId } },
            }),
          },
        });
        await this.audit.append(tx, {
          event: 'review.updated',
          actorUserId,
          subjectType: 'Review',
          subjectId: result.id,
        });
        return result;
      });
    } catch (error) {
      await this.nameMissingRelation(error, productId);
      throw error;
    }
  }

  remove(id: string, actorUserId: string): Promise<Review> {
    return this.databaseService.$transaction(async (tx) => {
      const review = await tx.review.delete({ where: { id } });
      await this.audit.append(tx, {
        event: 'review.deleted',
        actorUserId,
        subjectType: 'Review',
        subjectId: review.id,
      });
      return review;
    });
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
