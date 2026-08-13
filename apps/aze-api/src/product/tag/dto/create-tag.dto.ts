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
    example: ['0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('7', { each: true })
  productIds?: string[];
}
