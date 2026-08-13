import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProductCategoryDto {
  @ApiProperty({ example: 'Widgets' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
