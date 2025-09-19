import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ProductCategoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  create(createProductCategoryDto: Prisma.ProductCategoryCreateInput) {
    return this.databaseService.productCategory.create({
      data: createProductCategoryDto,
    });
  }

  findAll() {
    return this.databaseService.productCategory.findMany();
  }

  async findOne(id: number) {
    const productCategory =
      await this.databaseService.productCategory.findUnique({ where: { id } });
    if (!productCategory) {
      throw new NotFoundException(`Product category with ID ${id} not found`);
    }
    return productCategory;
  }

  update(
    id: number,
    updateProductCategoryDto: Prisma.ProductCategoryUpdateInput
  ) {
    return this.databaseService.productCategory.update({
      where: { id },
      data: updateProductCategoryDto,
    });
  }

  remove(id: number) {
    return this.databaseService.productCategory.delete({ where: { id } });
  }
}
