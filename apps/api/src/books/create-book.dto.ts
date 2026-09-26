import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateBookDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200)
  title: string;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160)
  author: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(32)
  isbn?: string;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(40)
  inventoryCode: string;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(40)
  shelfCode: string;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80)
  category: string;
}
