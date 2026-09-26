import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { McpClientService } from './mcp-client.service.js';
import { ChatScopeService } from './chat-scope.service.js';

@Module({ controllers: [ChatController], providers: [ChatService, ChatScopeService, McpClientService] })
export class ChatModule {}
