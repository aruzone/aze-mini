import { Controller, Get, Post, Body, Patch, Param, Delete, Query, DefaultValuePipe, ParseIntPipe, Res } from '@nestjs/common';
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MachineToMachine } from '../../config/decorators/machine-to-machine.decorator';
import { IsPositivePipe } from '../../config/pipes/is-positive.pipe';
import { CACHE_STATUS_HEADER, cacheStatus } from '../../cache/cache-status';

// Whether a response came out of Redis is part of a cached route's contract,
// so the document says so rather than leaving a caller to discover it.
const CACHE_STATUS_RESPONSE_HEADER = {
  [CACHE_STATUS_HEADER]: {
    description: 'Whether this response was served from the cache',
    schema: { type: 'string', enum: ['HIT', 'MISS'] },
  },
};

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
  @ApiOkResponse({ headers: CACHE_STATUS_RESPONSE_HEADER })
  @Get()
  async findAll(
    @Query('sort') sort: 'asc' | 'desc' = 'asc',
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe, IsPositivePipe) limit: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const read = await this.productsService.findAll(sort, limit);
    response.setHeader(CACHE_STATUS_HEADER, cacheStatus(read.hit));
    return read.value;
  }

  @ApiOkResponse({ headers: CACHE_STATUS_RESPONSE_HEADER })
  @Get(':id')
  async findOne(@Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    const read = await this.productsService.findOne(id);
    response.setHeader(CACHE_STATUS_HEADER, cacheStatus(read.hit));
    return read.value;
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
