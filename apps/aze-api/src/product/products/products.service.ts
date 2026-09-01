import { Product, ProductSort } from '@aze-mini/demo-contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ConfigService } from '@nestjs/config';
import { RECORD_NOT_FOUND, isPrismaError } from '../../database/prisma-errors';
import { refuseIfReferenced } from '../../database/referenced-rows';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CachedRead, ProductCache } from './product-cache';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly cache: ProductCache,
    private readonly audit: AuditService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    actorUserId: string | null,
  ): Promise<Product> {
    const { categoryId, tagIds, ...product } = createProductDto;
    try {
      const created = await this.databaseService.$transaction(async (tx) => {
        const result = await tx.product.create({
          data: {
            ...product,
            category: { connect: { id: categoryId } },
            ...(tagIds && { tags: { connect: tagIds.map((id) => ({ id })) } }),
          },
        });
        await this.audit.append(tx, {
          event: 'product.created',
          actorUserId,
          subjectType: 'Product',
          subjectId: result.id,
        });
        return result;
      });
      await this.cache.forgetList();
      return created;
    } catch (error) {
      await this.nameMissingRelation(error, categoryId, tagIds);
      throw error;
    }
  }

  async findAll(sort: ProductSort, limit?: number): Promise<CachedRead<Product[]>> {
    return this.cache.readList(sort, limit, () =>
      this.databaseService.product.findMany({
        orderBy: { id: sort },
        take: limit,
      }),
    );
  }

  async findOne(id: string): Promise<CachedRead<Product>> {
    return this.cache.readOne(id, async () => {
      const product = await this.databaseService.product.findUnique({ where: { id } });
      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      return product;
    });
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    actorUserId: string,
  ): Promise<Product> {
    const { categoryId, tagIds, ...product } = updateProductDto;
    try {
      const updated = await this.databaseService.$transaction(async (tx) => {
        const result = await tx.product.update({
          where: { id },
          data: {
            ...product,
            ...(categoryId !== undefined && {
              category: { connect: { id: categoryId } },
            }),
            ...(tagIds && { tags: { set: tagIds.map((tagId) => ({ id: tagId })) } }),
          },
        });
        await this.audit.append(tx, {
          event: 'product.updated',
          actorUserId,
          subjectType: 'Product',
          subjectId: result.id,
        });
        return result;
      });
      await this.cache.forget(id);
      return updated;
    } catch (error) {
      await this.nameMissingRelation(error, categoryId, tagIds);
      throw error;
    }
  }

  async remove(id: string, actorUserId: string): Promise<Product> {
    await refuseIfReferenced(
      `Product with ID ${id}`,
      { one: 'review', many: 'reviews' },
      () => this.databaseService.review.count({ where: { productId: id } }),
    );
    const removed = await this.databaseService.$transaction(async (tx) => {
      const result = await tx.product.delete({ where: { id } });
      await this.audit.append(tx, {
        event: 'product.deleted',
        actorUserId,
        subjectType: 'Product',
        subjectId: result.id,
      });
      return result;
    });
    await this.cache.forget(id);
    return removed;
  }

  // Prisma reports a failed connect as P2025 naming the relation, never the id
  // that missed, so a caller who mistyped one id is told only that something
  // was absent. These lookups run after a write has already failed: the price
  // is paid by the request that was wrong, not by the ones that were right.
  private async nameMissingRelation(
    error: unknown,
    categoryId?: number,
    tagIds?: string[],
  ) {
    if (!isPrismaError(error, RECORD_NOT_FOUND)) {
      return;
    }

    if (categoryId !== undefined) {
      const category = await this.databaseService.productCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!category) {
        throw new NotFoundException(`Product category with ID ${categoryId} not found`);
      }
    }

    if (tagIds?.length) {
      const found = await this.databaseService.tag.findMany({
        where: { id: { in: tagIds } },
        select: { id: true },
      });
      const missing = tagIds.filter((tagId) => !found.some((tag) => tag.id === tagId));
      if (missing.length > 0) {
        throw new NotFoundException(
          missing.length === 1
            ? `Tag with ID ${missing[0]} not found`
            : `Tags with IDs ${missing.join(', ')} not found`,
        );
      }
    }
  }
}
