import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma';

@Injectable()
export class ProductsService {
  constructor(private readonly databaseService: DatabaseService, private readonly configService: ConfigService) {}

  async create(createProductDto: Prisma.ProductCreateInput) {
    return this.databaseService.product.create({ data: createProductDto });
  }

  async findAll(sort: 'asc' | 'desc', limit?: number) {
    return this.databaseService.product.findMany({
      orderBy: { id: sort },
      take: limit,
    });
  }

  async findOne(id: number) {
    const product = await this.databaseService.product.findUnique({ where: { id } });
    if(!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: number, updateProductDto: Prisma.ProductUpdateInput) {
    return this.databaseService.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: number) {
    return this.databaseService.product.delete({ where: { id } });
  }
}
