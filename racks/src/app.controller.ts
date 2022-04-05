import { Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { CompartmentDataDto, UpdateStateDto, WarehouseIdDto } from './compartmentData.dto';
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

  @Get('change/warehouse/id')
  async changeWarehouseId(@Query() warehouseIdDto: WarehouseIdDto) {
    return this.appService.changeWarehouseId(warehouseIdDto.warehouseId);
  }
}
