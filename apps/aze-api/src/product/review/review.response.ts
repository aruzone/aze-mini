import { Review as ReviewContract } from '@aze-mini/demo-contracts';
import { Wire } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';

export class Review implements Wire<ReviewContract> {
  @ApiProperty({ example: '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f' })
  id: string;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiProperty({ type: String, nullable: true, example: 'Does what it says' })
  comment: string | null;

  @ApiProperty({ example: '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f' })
  productId: string;

  @ApiProperty({ format: 'date-time', example: '2026-08-26T09:00:00.000Z' })
  createdAt: string;
}
