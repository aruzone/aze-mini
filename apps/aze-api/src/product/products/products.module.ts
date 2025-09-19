import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { ProductCategoryModule } from '../product-category/product-category.module';
import { ReviewModule } from '../review/review.module';
import { TagModule } from '../tag/tag.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ProductCategoryModule,
    ReviewModule,
    TagModule
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
