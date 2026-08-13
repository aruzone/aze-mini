import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // Replaces the linked Products on update rather than adding to them.
  @IsOptional()
  @IsArray()
  @IsUUID('7', { each: true })
  productIds?: string[];
}
