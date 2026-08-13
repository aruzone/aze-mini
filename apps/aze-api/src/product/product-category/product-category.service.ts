import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { DatabaseService } from '../../database/database.service';

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

  remove(id: number) {
    return this.databaseService.productCategory.delete({ where: { id } });
  }
}
