import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HttpException } from '@nestjs/common';
const axios = require('axios').default;
import moment = require('moment');
import { Cron } from '@nestjs/schedule';
let internetDown = false;
const fs = require('fs');
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
@Injectable()
export class AppService {
  static warehouseId: string;
  constructor(
    @InjectModel('rack-schema') private readonly racksModel,
  ) { this.initializeServer(); }
  async initializeServer() {
    //Clearing prev stored data
    const allData = await this.racksModel.find().exec();
    allData.forEach(async element => {
      await element.delete();
    });

    try {
      let configs = await fs.readFileSync('./configs.json', 'utf8');
      configs = JSON.parse(configs);
      AppService.warehouseId = configs["warehouseId"];
      console.log("Server Started, WareHouse ID: " + configs["warehouseId"]);
    } catch (err) {
      console.log("No WareHouse ID is defined, please define WareHouse ID through API.");
    }
    this.pullCloudData();
  }

  async getCompartmentData(compartment) {
    if (internetDown) {
      throw new HttpException({}, 408);
    } else {
      try {
        const compartmentObj = await this.racksModel.findOne({ compartment: compartment }).exec();
        if (compartmentObj) {
          const currentDate = moment();
          compartmentObj.lastSeen = currentDate;
          compartmentObj.status = true;
          await compartmentObj.save();
          // if (compartmentObj.compartment == "A-01") {
          //   compartmentObj.boxstate = "R";
          //   console.log(compartmentObj);
          // }
          // console.log(compartment);

          return compartmentObj;
        }
        //console.log("Compartment Not Found");
        return "Compartment Not Found";
      } catch (e) {
        console.log("Err getCompartmentData");

        return e.message;
      }
    }
  }

  async updateState(updateStateDto) {
    const boxChar = updateStateDto.compartment.split("-")[0];
    const boxNum = updateStateDto.compartment.split("-")[1];

    if (boxChar === "Z") {
      //This section is to detect if the compartments are on fresh start then in future they will send all the states of switches, we can syncs them with server
      const arrayBoxes = ["A", "B", "C", "D"];
      console.log("Updating all compartment states");
      arrayBoxes.forEach(async box => {
        const compartmentObj = await this.racksModel.findOne({ compartment: box + "-" + boxNum }).exec();
        let boxStatesObj = { status: "", boxstate: "" };
        switch (boxChar) {
          case "A":
            boxStatesObj = await this.getBoxState(updateStateDto.Astate1, updateStateDto.Astate2);
            break;
          case "B":
            boxStatesObj = await this.getBoxState(updateStateDto.Bstate1, updateStateDto.Bstate2);
            break;
          case "C":
            boxStatesObj = await this.getBoxState(updateStateDto.Cstate1, updateStateDto.Cstate2);
            break;
          case "D":
            boxStatesObj = await this.getBoxState(updateStateDto.Dstate1, updateStateDto.Dstate2);
            break;
        }
        const boxstate = boxStatesObj.boxstate;
        const currentDate = moment();
        compartmentObj.liveBoxstate = boxstate;
        compartmentObj.lastSeen = currentDate;
        compartmentObj.status = true;
        await compartmentObj.save();
        console.log("Done!");
      });
    } else {
      //This section is when a change of state is detected like opening a locker, then we can update the state on server.
      let boxStatesObj = { status: "", boxstate: "" };
      console.log(updateStateDto.compartment);
      switch (boxChar) {
        case "A":
          boxStatesObj = await this.getBoxState(updateStateDto.Astate1, updateStateDto.Astate2);
          break;
        case "B":
          boxStatesObj = await this.getBoxState(updateStateDto.Bstate1, updateStateDto.Bstate2);
          break;
        case "C":
          boxStatesObj = await this.getBoxState(updateStateDto.Cstate1, updateStateDto.Cstate2);
          break;
        case "D":
          boxStatesObj = await this.getBoxState(updateStateDto.Dstate1, updateStateDto.Dstate2);
          break;
      }
      const status = boxStatesObj.status;
      const boxstate = boxStatesObj.boxstate;
      console.log(status, boxstate);
      console.log("--------------------------");
      if (status) {
        const compartmentObj = await this.racksModel.findOne({ compartment: updateStateDto.compartment }).exec();
        if (compartmentObj) {
          const currentDate = moment();
          compartmentObj.liveBoxstate = boxstate;
          compartmentObj.lastSeen = currentDate;
          compartmentObj.status = true;
          await compartmentObj.save();
        }
        this.putApiCall(updateStateDto.compartment, status);
      }
    }
  }

  async changeWarehouseId(warehouseId) {
    if (!warehouseId) {
      throw new HttpException({ message: "Please provide warehouseId in query params." }, 400);
    }
    console.log("Received warehouse id: ", warehouseId);
    await fs.writeFile('./configs.json', '{"warehouseId":' + warehouseId + '}', (err) => {
      if (err) throw err;
    });
    AppService.warehouseId = warehouseId;
    console.log("Successfully changed!");
    return "WareHouse ID changed to: " + String(warehouseId) + " successfully!";
  }

  async putApiCall(compartment, status) {
    if (!AppService.warehouseId) {
      console.log("No WareHouse ID is defined, please define WareHouse ID through API.");
      return;
    }
    const options = {
      url: 'https://api.airliftgrocer.com/compartment/status',
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
        auth: 'Groc3R@Sm@rtR@ck',
      },
      data: {
        "warehouseId": String(AppService.warehouseId),
        "rack": compartment,
        "status": status,
        // "byAdmin": true
      },
    };
    // console.log(options);
    axios(options)
      .then(response => {
        // console.log(response);
        console.log("Event log Success: compartment " + compartment + " updated PUT API, Status: " + status);
        return "Updated";
      })
      .catch(err => {
        console.error("Event log Error: PUT API");
        console.log(err.response.data);
        return err;
      });
  }

  // Cron Jobs

  // One minute
  @Cron("*/5 * * * *")
  async patchCompartmentStates() {
    if (!AppService.warehouseId) {
      console.log("No WareHouse ID is defined, please define WareHouse ID through API.");
      return;
    }
    const allData = await this.racksModel.find().exec();
    const compartmentsStatusArray = [];
    allData.forEach(element => {
      let status = "";
      if (element.liveBoxstate == "R") {
        status = "available";
      } else if (element.liveBoxstate == "L") {
        status = "occupied";
      } else if (element.liveBoxstate == "F") {
        status = "unlocked";
      } else {
        return "";
      }
      if (element.status) {
        compartmentsStatusArray.push({
          warehouseId: String(AppService.warehouseId),
          rack: element.compartment,
          status: status
        });
      }
    });
    if (compartmentsStatusArray && compartmentsStatusArray.length) {
      const options = {
        url: 'https://api.airliftgrocer.com/compartment/warehouses/tags/status',
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
          auth: 'Groc3R@Sm@rtR@ck',
        },
        data: {
          compartmentsStatusArray: compartmentsStatusArray
        },
      };
      axios(options)
        .then(response => {
          console.log("Patch API Success");
          // console.log(response);
          return "Updated";
        })
        .catch(err => {
          console.error("Patch API Failed");
          // console.log(err.response);
          return err;
        });
    }
  }

  //60 Seconds to check if any compartment is active or inactive
  @Cron("*/60 * * * * *")
  async updateCompartments() {
    const currentDate = moment();
    const allData = await this.racksModel.find().exec();
    allData.forEach(async element => {
      if (element.lastSeen) {
        const lastSeen = moment(element.lastSeen);
        // console.log(currentDate.diff(lastSeen, 'seconds'));
        const lastSeenDiff = currentDate.diff(lastSeen, 'seconds');
        if (lastSeenDiff > 59) {
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
    if (!AppService.warehouseId) {
      console.log("No WareHouse ID is defined, please define WareHouse ID through API.");
      return;
    }
    try {
      const response = await axios.get('https://api.airliftgrocer.com/v2/orders/packed/compartments?warehouse=' + String(AppService.warehouseId), {
        headers: {
          auth: 'Groc3R@Sm@rtR@ck',
        },
        timeout: 4000,
      });
      if (response.data && response.data.length) {
        internetDown = false;
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
      } else {
        console.log("No Data Retured from cloud API");
      }
      return response.data;
    } catch (err) {
      internetDown = true;
      console.error("Cannot Pull Latest Data");
      // console.log(err);
    }
  }

  async getBoxState(state1, state2) {
    console.log(state1, state2);
    let status = "";
    let boxstate = "";
    if (state1 == "0" && state2 == "0") {
      status = "occupied";
      boxstate = "L";
    } else if (state1 == "1" && state2 == "0") {
      status = "unlocked";
      boxstate = "F";
    } else if (state1 == "0" && state2 == "1") {
      status = "available";
      boxstate = "R";
    } else if (state1 == "1" && state2 == "1") {
      status = "unlocked"; // change to hack state when needed
      boxstate = "F";
    }
    return { status, boxstate };
  }
}
