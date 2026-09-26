import { Body, Controller, Get, Post } from '@nestjs/common';
import { ChatDto } from './chat.dto.js';
import { ChatService } from './chat.service.js';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}
  @Get('status') status() { return this.chat.status(); }
  @Post() answer(@Body() dto: ChatDto) { return this.chat.answer(dto); }
}
