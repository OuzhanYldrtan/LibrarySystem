import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateMemberDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MinLength(3) @MaxLength(120)
  fullName: string;

  @Matches(/^\d{11}$/, { message: 'TC kimlik numarası 11 rakam olmalıdır.' })
  tcIdentityNo: string;

  @IsDateString({}, { message: 'Doğum tarihi geçerli olmalıdır.' })
  birthDate: string;

  @Transform(trim) @IsOptional() @IsEmail({}, { message: 'E-posta adresi geçerli olmalıdır.' })
  email?: string;

  @Transform(trim) @IsOptional() @Matches(/^[0-9+()\s-]{7,20}$/, { message: 'Telefon numarası geçerli olmalıdır.' })
  phone?: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(500)
  address?: string;
}
