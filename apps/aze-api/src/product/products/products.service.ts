import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ConfigService } from '@nestjs/config';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly databaseService: DatabaseService, private readonly configService: ConfigService) {}

  async create(createProductDto: CreateProductDto) {
    const { categoryId, ...product } = createProductDto;
    return this.databaseService.product.create({
      data: { ...product, category: { connect: { id: categoryId } } },
    });
  }

  async findAll(sort: 'asc' | 'desc', limit?: number) {
    return this.databaseService.product.findMany({
      orderBy: { id: sort },
      take: limit,
    });
  }

  async findOne(id: string) {
    const product = await this.databaseService.product.findUnique({ where: { id } });
    if(!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { categoryId, ...product } = updateProductDto;
    return this.databaseService.product.update({
      where: { id },
      data: categoryId === undefined
        ? product
        : { ...product, category: { connect: { id: categoryId } } },
    });
  }

  async remove(id: string) {
    return this.databaseService.product.delete({ where: { id } });
  }
}
