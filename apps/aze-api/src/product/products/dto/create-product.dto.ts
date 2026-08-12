import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

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

  // The relation is a flat id on the wire; the service turns it into Prisma's
  // nested connect, so the contract does not carry Prisma's vocabulary.
  @Type(() => Number)
  @IsInt()
  categoryId: number;
}
