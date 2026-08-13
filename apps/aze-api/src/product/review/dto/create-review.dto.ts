import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsUUID('7')
  productId: string;
}
