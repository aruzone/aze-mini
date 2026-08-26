import { ProductCategory as ProductCategoryContract } from '@aze-mini/demo-contracts';
import { Wire } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';

export class ProductCategory implements Wire<ProductCategoryContract> {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Widgets' })
  name: string;
}
