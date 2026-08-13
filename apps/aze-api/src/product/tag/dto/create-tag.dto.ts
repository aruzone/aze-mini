import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ example: 'seasonal' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Replaces the linked Products on update rather than adding to them',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('7', { each: true })
  productIds?: string[];
}
