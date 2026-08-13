import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Widget' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'A widget of the finest quality' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 9.99 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ description: 'Id of an existing category', example: 1 })
  @IsInt()
  categoryId: number;

  @ApiPropertyOptional({
    description: 'Replaces the linked Tags on update rather than adding to them',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('7', { each: true })
  tagIds?: string[];
}
