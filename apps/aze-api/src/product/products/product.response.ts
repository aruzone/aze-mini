import { Product as ProductContract } from '@aze-mini/demo-contracts';
import { Wire } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';

export class Product implements Wire<ProductContract> {
  @ApiProperty({ example: '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'Widget' })
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'A widget of the finest quality',
  })
  description: string | null;

  @ApiProperty({ example: 9.99 })
  price: number;

  @ApiProperty({ example: 1 })
  categoryId: number;

  @ApiProperty({ format: 'date-time', example: '2026-08-26T09:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ format: 'date-time', example: '2026-08-26T09:00:00.000Z' })
  updatedAt: string;
}
