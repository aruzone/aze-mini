import { Tag } from '@aze-mini/demo-contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { DatabaseService } from '../../database/database.service';
import { RECORD_NOT_FOUND, isPrismaError } from '../../database/prisma-errors';

@Injectable()
export class TagService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createTagDto: CreateTagDto): Promise<Tag> {
    const { productIds, ...tag } = createTagDto;
    try {
      return await this.databaseService.tag.create({
        data: {
          ...tag,
          ...(productIds && { products: { connect: productIds.map((id) => ({ id })) } }),
        },
      });
    } catch (error) {
      await this.nameMissingRelation(error, productIds);
      throw error;
    }
  }

  findAll(): Promise<Tag[]> {
    return this.databaseService.tag.findMany();
  }

  async findOne(id: string): Promise<Tag> {
    const tag = await this.databaseService.tag.findUnique({
      where: { id },
    });
    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }
    return tag;
  }

  async update(id: string, updateTagDto: UpdateTagDto): Promise<Tag> {
    const { productIds, ...tag } = updateTagDto;
    try {
      return await this.databaseService.tag.update({
        where: { id },
        data: {
          ...tag,
          ...(productIds && { products: { set: productIds.map((pid) => ({ id: pid })) } }),
        },
      });
    } catch (error) {
      await this.nameMissingRelation(error, productIds);
      throw error;
    }
  }

  remove(id: string): Promise<Tag> {
    return this.databaseService.tag.delete({ where: { id } });
  }

  // Prisma reports a failed connect as P2025 naming the relation, never the id
  // that missed. The lookup runs after the write has already failed, so only a
  // request that named a bad id pays for the answer.
  private async nameMissingRelation(error: unknown, productIds?: string[]) {
    if (!isPrismaError(error, RECORD_NOT_FOUND) || !productIds?.length) {
      return;
    }

    const found = await this.databaseService.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const missing = productIds.filter((id) => !found.some((product) => product.id === id));
    if (missing.length > 0) {
      throw new NotFoundException(
        missing.length === 1
          ? `Product with ID ${missing[0]} not found`
          : `Products with IDs ${missing.join(', ')} not found`,
      );
    }
  }
}
