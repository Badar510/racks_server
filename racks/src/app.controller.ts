import { Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { CompartmentDataDto, UpdateStateDto } from './compartmentData.dto';
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get('compartmentData')
  async Dashboard(@Query() compartmentDataDto: CompartmentDataDto) {
    return this.appService.getCompartmentData(compartmentDataDto.compartment);
  }

  @Get('updateState')
  async updateState(@Query() updateStateDto: UpdateStateDto) {
    return this.appService.updateState(updateStateDto);
  }
}
