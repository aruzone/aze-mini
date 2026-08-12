import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsInt()
  categoryId: number;

  // Replaces the linked Tags on update rather than adding to them.
  @IsOptional()
  @IsArray()
  @IsUUID('7', { each: true })
  tagIds?: string[];
}
