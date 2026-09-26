import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateMemberDto } from './create-member.dto.js';
import { MembersService } from './members.service.js';

@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list() { return this.members.list(); }

  @Post()
  create(@Body() dto: CreateMemberDto) { return this.members.create(dto); }
}
