import { Controller, Get, Post, Query} from '@nestjs/common';
import { AppService } from './app.service';

@Controller('racks')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getStatus(@Query() query) {
    return this.appService.getStatus(query);
  }

  @Post('lock')
  postHello(@Query() query) {
    return this.appService.changeStatus(query);
  }
}
