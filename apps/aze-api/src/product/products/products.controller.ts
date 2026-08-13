import { Controller, Get, Post, Body, Patch, Param, Delete, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MachineToMachine } from '../../config/decorators/machine-to-machine.decorator';
import { IsPositivePipe } from '../../config/pipes/is-positive.pipe';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @MachineToMachine()
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  // Both have defaults, and the union type erases to Object, so the document
  // would otherwise demand two values a caller never has to supply.
  @ApiQuery({ name: 'sort', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
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

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
