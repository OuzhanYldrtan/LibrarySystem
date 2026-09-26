import { IsDateString, IsInt, Min } from 'class-validator';

export class CreateLoanDto {
  @IsInt() @Min(1) bookId: number;
  @IsInt() @Min(1) memberId: number;
  @IsDateString() dueAt: string;
}
