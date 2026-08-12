import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReviewDto {
  @Type(() => Number)
  @IsInt()
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;

  // uuid(7), matching the id the schema issues.
  @IsUUID('7')
  productId: string;
}
