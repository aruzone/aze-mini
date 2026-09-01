import { ProductCategory } from '@aze-mini/demo-contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { DatabaseService } from '../../database/database.service';
import { refuseIfReferenced } from '../../database/referenced-rows';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ProductCategoryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  create(
    createProductCategoryDto: CreateProductCategoryDto,
    actorUserId: string,
  ): Promise<ProductCategory> {
    return this.databaseService.$transaction(async (tx) => {
      const category = await tx.productCategory.create({
        data: createProductCategoryDto,
      });
      await this.audit.append(tx, {
        event: 'product-category.created',
        actorUserId,
        subjectType: 'ProductCategory',
        subjectId: String(category.id),
      });
      return category;
    });
  }

  findAll(): Promise<ProductCategory[]> {
    return this.databaseService.productCategory.findMany();
  }

  async findOne(id: number): Promise<ProductCategory> {
    const productCategory =
      await this.databaseService.productCategory.findUnique({ where: { id } });
    if (!productCategory) {
      throw new NotFoundException(`Product category with ID ${id} not found`);
    }
    return productCategory;
  }

  update(
    id: number,
    updateProductCategoryDto: UpdateProductCategoryDto,
    actorUserId: string,
  ): Promise<ProductCategory> {
    return this.databaseService.$transaction(async (tx) => {
      const category = await tx.productCategory.update({
        where: { id },
        data: updateProductCategoryDto,
      });
      await this.audit.append(tx, {
        event: 'product-category.updated',
        actorUserId,
        subjectType: 'ProductCategory',
        subjectId: String(category.id),
      });
      return category;
    });
  }

  async remove(id: number, actorUserId: string): Promise<ProductCategory> {
    await refuseIfReferenced(
      `Product category with ID ${id}`,
      { one: 'product', many: 'products' },
      () => this.databaseService.product.count({ where: { categoryId: id } }),
    );
    return this.databaseService.$transaction(async (tx) => {
      const category = await tx.productCategory.delete({ where: { id } });
      await this.audit.append(tx, {
        event: 'product-category.deleted',
        actorUserId,
        subjectType: 'ProductCategory',
        subjectId: String(category.id),
      });
      return category;
    });
  }
}
