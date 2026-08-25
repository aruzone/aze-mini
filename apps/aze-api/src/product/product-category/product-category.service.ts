import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { DatabaseService } from '../../database/database.service';
import { refuseIfReferenced } from '../../database/referenced-rows';

@Injectable()
export class ProductCategoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  create(createProductCategoryDto: CreateProductCategoryDto) {
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
    updateProductCategoryDto: UpdateProductCategoryDto
  ) {
    return this.databaseService.productCategory.update({
      where: { id },
      data: updateProductCategoryDto,
    });
  }

  async remove(id: number) {
    await refuseIfReferenced(
      `Product category with ID ${id}`,
      { one: 'product', many: 'products' },
      () => this.databaseService.product.count({ where: { categoryId: id } }),
    );
    return this.databaseService.productCategory.delete({ where: { id } });
  }
}
