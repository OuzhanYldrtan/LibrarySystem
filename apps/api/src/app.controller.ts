import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', database: 'postgresql', backend: 'nestjs', date: new Date().toISOString() };
  }
}
