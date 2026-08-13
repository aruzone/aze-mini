import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  rating: number;

  @ApiPropertyOptional({ example: 'Solid build, arrived early' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ description: 'Id of the Product being reviewed' })
  @IsUUID('7')
  productId: string;
}
