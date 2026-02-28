import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ProductCategoryService } from './product-category.service';
import { Prisma } from '../../../generated/prisma';
import { ApiKeyGuard } from '../../config/guards/api-key.guard';
import { AuthGuard } from '../../config/guards/auth.guard';

@Controller('categories')
export class ProductCategoryController {
  constructor(private readonly productCategoryService: ProductCategoryService) {}

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Post()
  create(@Body() createProductCategoryDto: Prisma.ProductCategoryCreateInput) {
    return this.productCategoryService.create(createProductCategoryDto);
  }

  @Get()
  findAll() {
    return this.productCategoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productCategoryService.findOne(+id);
  }

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductCategoryDto: Prisma.ProductCategoryUpdateInput) {
    return this.productCategoryService.update(+id, updateProductCategoryDto);
  }

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productCategoryService.remove(+id);
  }
}
