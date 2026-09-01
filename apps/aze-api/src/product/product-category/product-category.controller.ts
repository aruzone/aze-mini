import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { ProductCategoryService } from './product-category.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { ProductCategory } from './product-category.response';
import { ApiRefusal } from '../../config/decorators/api-refusal.decorator';
import { CurrentUser } from '../../config/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/token-claims';

@Controller('categories')
export class ProductCategoryController {
  constructor(private readonly productCategoryService: ProductCategoryService) {}

  @ApiCreatedResponse({ description: 'The created category', type: ProductCategory })
  @ApiRefusal(HttpStatus.CONFLICT, 'That name is already taken')
  @Post()
  create(
    @Body() createProductCategoryDto: CreateProductCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productCategoryService.create(createProductCategoryDto, user.userId);
  }

  @ApiOkResponse({ description: 'Every category', type: [ProductCategory] })
  @Get()
  findAll() {
    return this.productCategoryService.findAll();
  }

  @ApiOkResponse({ description: 'One category', type: ProductCategory })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productCategoryService.findOne(+id);
  }

  @ApiOkResponse({ description: 'The updated category', type: ProductCategory })
  @ApiRefusal(HttpStatus.CONFLICT, 'That name is already taken')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductCategoryDto: UpdateProductCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productCategoryService.update(+id, updateProductCategoryDto, user.userId);
  }

  @ApiOkResponse({ description: 'The deleted category', type: ProductCategory })
  @ApiRefusal(HttpStatus.CONFLICT, 'Products are still in this category')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productCategoryService.remove(+id, user.userId);
  }
}
