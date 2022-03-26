import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
const axios = require('axios').default;
import moment = require('moment');
const warehouseId = "386";
import { Cron } from '@nestjs/schedule';

@Injectable()
export class AppService {
  constructor(
    @InjectModel('rack-schema') private readonly racksModel,
  ) {
    // this.patchCompartmentStates();
  }

  async getCompartmentData(compartment) {
    try {
      const compartmentObj = await this.racksModel.findOne({ compartment: compartment }).exec();
      if (compartmentObj) {
        const currentDate = moment();
        compartmentObj.lastSeen = currentDate;
        compartmentObj.status = true;
        await compartmentObj.save();
        return compartmentObj;
      }
      return "Compartment Not Found";
    } catch (e) {
      return e.message;
    }
  }

  async updateState(updateStateDto) {
    const compartmentObj = await this.racksModel.findOne({ compartment: updateStateDto.compartment }).exec();
    if (compartmentObj) {
      const currentDate = moment();
      compartmentObj.boxstate = updateStateDto.boxstate;
      compartmentObj.lastSeen = currentDate;
      compartmentObj.status = true;
      await compartmentObj.save();
    }

    let status = "";
    if (updateStateDto.boxstate == "R") {
      status = "available";
    } else if (updateStateDto.boxstate == "L") {
      status = "occupied";
    } else if (updateStateDto.boxstate == "F") {
      status = "unlocked";
    } else {
      return "";
    }
    try {
      const response = await axios.put('https://api.airliftgrocer.com/compartment/status', {
        headers: {
          auth: 'Groc3R@Sm@rtR@ck',
        },
        data: {
          warehouseId: warehouseId,
          rack: updateStateDto.compartment,
          status: status,
          byAdmin: true
        },
      });

      return response.data;
    } catch (err) {
      console.log(err.response.status);
    }
  }




  // Cron Jobs
  // One minute
  @Cron("* * * * *")
  async patchCompartmentStates() {
    const allData = await this.racksModel.find().exec();
    const compartmentsStatusArray = [];
    allData.forEach(element => {
      let status = "";
      if (element.boxstate == "R") {
        status = "available";
      } else if (element.boxstate == "L") {
        status = "occupied";
      } else if (element.boxstate == "F") {
        status = "unlocked";
      } else {
        return "";
      }
      if (element.status) {
        compartmentsStatusArray.push({
          warehouseId: warehouseId,
          rack: element.compartment,
          status: status
        });
      }
    });
    // console.log(compartmentsStatusArray);

    try {
      const response = await axios.patch('https://api.airliftgrocer.com/compartment/warehouses/tags/status:', {
        headers: {
          auth: 'Groc3R@Sm@rtR@ck',
        },
        data: {
          compartmentsStatusArray: compartmentsStatusArray
        },
      });

      return response.data;
    } catch (err) {
      console.log(err.response.status);
    }
  }

  //15 Seconds to check if any compartment is active or inactive
  @Cron("*/15 * * * * *")
  async updateCompartments() {
    const currentDate = moment();
    const allData = await this.racksModel.find().exec();
    allData.forEach(async element => {
      if (element.lastSeen) {
        const lastSeen = moment(element.lastSeen);
        // console.log(currentDate.diff(lastSeen, 'seconds'));
        const lastSeenDiff = currentDate.diff(lastSeen, 'seconds');
        if (lastSeenDiff > 15) {
          element.status = false;
        }
      } else {
        element.status = false;
      }
      await element.save();
      // console.log(element);
    });
  }


  @Cron("*/5 * * * * *")
  async pullCloudData() {
    try {
      const response = await axios.get('https://api.airliftgrocer.com/v2/orders/packed/compartments?warehouse=' + warehouseId, {
        headers: {
          auth: 'Groc3R@Sm@rtR@ck',
        },
      });

      response.data.forEach(async eachData => {
        const compartmentObj = await this.racksModel.findOne({ compartment: eachData['compartment'] }).exec();
        if (compartmentObj) {
          compartmentObj.code = eachData['code'];
          compartmentObj.time = eachData['time'];
          compartmentObj.duration = eachData['duration'];
          compartmentObj.boxstate = eachData['boxstate'];
          await compartmentObj.save();
          // console.log('Updated');
        } else {
          const data = new this.racksModel({
            compartment: eachData['compartment'],
            code: eachData['code'],
            time: eachData['time'],
            duration: eachData['duration'],
            boxstate: eachData['boxstate']
          });
          await data.save();
          // console.log('Created new');
        }
      });
      return response.data;
    } catch (err) {
      console.log(err);
    }
  }
}
