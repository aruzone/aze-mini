import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma';

@Injectable()
export class ProductCategoryService {
  create(createProductCategoryDto: Prisma.ProductCategoryCreateInput) {
    return 'This action adds a new productCategory';
  }

  findAll() {
    return `This action returns all productCategory`;
  }

  findOne(id: number) {
    return `This action returns a #${id} productCategory`;
  }

  update(id: number, updateProductCategoryDto: Prisma.ProductCategoryUpdateInput) {
    return `This action updates a #${id} productCategory`;
  }

  remove(id: number) {
    return `This action removes a #${id} productCategory`;
  }
}
