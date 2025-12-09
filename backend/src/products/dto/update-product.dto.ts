import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true || value === '1'
      ? true
      : value === 'false' || value === false || value === '0'
        ? false
        : value,
  )
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  removeImageIds?: number[];
}
