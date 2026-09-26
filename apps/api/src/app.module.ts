import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { DatabaseModule } from './database/database.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { BooksModule } from './books/books.module.js';
import { MembersModule } from './members/members.module.js';
import { LoansModule } from './loans/loans.module.js';
import { ChatModule } from './chat/chat.module.js';

@Module({
  imports: [DatabaseModule, DashboardModule, BooksModule, MembersModule, LoansModule, ChatModule],
  controllers: [AppController],
})
export class AppModule {}
