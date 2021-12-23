import { Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  serverInitialize() {
    return this.appService.serverInitialize();
  }

  @Get('racks')
  getStatus(@Query() query) {
    return this.appService.getStatus(query);
  }

  @Post('racks/lock')
  postHello(@Query() query) {
    return this.appService.changeStatus(query);
  }
}
