import { Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { CompartmentDataDto, UpdateStateDto, WarehouseIdDto, ManualOverRideDto } from './queryParams.dto'
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get('compartmentData')
  async Dashboard(@Query() compartmentDataDto: CompartmentDataDto) {
    return this.appService.getCompartmentData(compartmentDataDto.compartment, compartmentDataDto.relayBox);
  }

  @Get('updateState')
  async updateState(@Query() updateStateDto: UpdateStateDto) {
    return this.appService.updateState(updateStateDto);
  }

  @Get('change/warehouse/id')
  async changeWarehouseId(@Query() warehouseIdDto: WarehouseIdDto) {
    return this.appService.changeWarehouseId(warehouseIdDto.warehouseId);
  }

  @Get('manual/override')
  async manualOverRide(@Query() manualOverRideDto: ManualOverRideDto) {
    return this.appService.manualOverRide(manualOverRideDto);
  }
}
