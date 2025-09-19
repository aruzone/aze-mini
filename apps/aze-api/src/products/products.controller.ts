import { Controller, Get, Post, Body, Patch, Param, Delete, Query, DefaultValuePipe, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Prisma } from '../../generated/prisma';
import { ApiKeyGuard } from '../config/guards/api-key.guard';
import { AuthGuard } from '../config/guards/auth.guard';
import { IsPositivePipe } from '../config/pipes/is-positive.pipe';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Post()
  create(@Body() createProductDto: Prisma.ProductCreateInput) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll(
    @Query('sort') sort: 'asc' | 'desc' = 'asc',
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe, IsPositivePipe) limit: number,
  ) {
    return this.productsService.findAll(sort, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: Prisma.ProductUpdateInput) {
    return this.productsService.update(id, updateProductDto);
  }

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  // @UseGuards(ApiKeyGuard, AuthGuard)
  // @Post('categories')
  // createCategory(@Body() createCategoryDto: Prisma.ProductCategoriesCreateInput) {
  //   return this.productsService.createCategory(createCategoryDto);
  // }
  
  // @Get('categories')
  // findAllCategories() {
  //   return this.productsService.findAllCategories();
  // }
}
