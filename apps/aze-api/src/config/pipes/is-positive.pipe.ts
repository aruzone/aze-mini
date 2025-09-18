import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class IsPositivePipe implements PipeTransform {
  transform(value: number, metadata: ArgumentMetadata) {
    if (value <= 0) {
      throw new BadRequestException('Value must be a positive number');
    }
    return value;
  }
}
