import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateLoanDto } from './loan.dto.js';
import { LoansService } from './loans.service.js';

@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}
  @Get() list() { return this.loans.list(); }
  @Post() create(@Body() dto: CreateLoanDto) { return this.loans.create(dto); }
  @Post(':id/return') returnLoan(@Param('id', ParseIntPipe) id: number) { return this.loans.returnLoan(id); }
}
