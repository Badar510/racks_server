/* eslint-disable @typescript-eslint/no-var-requires */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HttpException } from '@nestjs/common';
import moment = require('moment');
import { Cron } from '@nestjs/schedule';
let internetDown = false;
import * as fs from 'fs';
const axios = require('axios').default;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
@Injectable()
export class AppService {
  static warehouseId: string;
  static serverIP: string;
  static serverNum: number;
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
      console.error(err);
      console.log("No WareHouse ID is defined, please define WareHouse ID through API.");
    }
    // this.updateServerForeignIp();
    this.pullCloudData();
  }

  async getCompartmentData(compartment, relayBox) {
    if (internetDown) {
      throw new HttpException({}, 408);
    } else {
      try {
        const compartmentObj = await this.racksModel.findOne({ compartment: compartment }).exec();
        if (compartmentObj) {
          const currentDate = moment();
          compartmentObj.lastSeen = currentDate;
          compartmentObj.status = true;
          compartmentObj.relayBox = relayBox;
          await compartmentObj.save();
          const numCompartment = parseInt(compartment.split("-")[1]);
          if (numCompartment >= 1 && numCompartment <= 6) {
            AppService.serverNum = 1;
          } else {
            AppService.serverNum = 2;
          }
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
    const currentDate = moment();
    const boxChar = updateStateDto.compartment.split("-")[0];
    const boxNum = updateStateDto.compartment.split("-")[1];
    if (boxChar === "Z") {
      //This section is to detect if the compartments are on fresh start then in future they will send all the states of switches, we can syncs them with server
      const arrayBoxes = ["A", "B", "C", "D"];
      console.log("Updating all compartment states, box number: " + boxNum);
      arrayBoxes.forEach(async box => {
        const compartmentObj = await this.racksModel.findOne({ compartment: box + "-" + boxNum }).exec();
        if (compartmentObj) {
          let boxStatesObj = { status: "", boxstate: "" };
          switch (box) {
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
          compartmentObj.liveBoxstate = boxstate;
          compartmentObj.lastFeedbackReqTime = currentDate;
          compartmentObj.feedback = true;
          await compartmentObj.save();
        }
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
        let side = "";
        const compartmentObj = await this.racksModel.findOne({ compartment: updateStateDto.compartment }).exec();
        console.log(compartmentObj.liveBoxstate);
        if (compartmentObj) {
          if (compartmentObj.liveBoxstate == "R" && boxstate == "L") {
            side = "picker";
          } else if (compartmentObj.liveBoxstate == "F" && boxstate == "L") {
            side = "rider";
          }
          compartmentObj.liveBoxstate = boxstate;
          compartmentObj.lastFeedbackReqTime = currentDate;
          compartmentObj.feedback = true;
          await compartmentObj.save();
        }
        if (status == 'occupied' || status == 'available')
          this.putApiCall(updateStateDto.compartment, status, side);
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

  async manualOverRide(manualOverRideDto) {
    const currentDate = moment();
    if (manualOverRideDto.compartment) {
      const compartment = await this.racksModel.findOne({ compartment: manualOverRideDto.compartment }).exec();
      compartment.boxstate = manualOverRideDto.boxstate;
      compartment.manualOverRideTime = currentDate;
      compartment.manualOverRideTimeout = manualOverRideDto.timeout;
      if (manualOverRideDto.boxstate == "L")
        compartment.code = manualOverRideDto.code;
      await compartment.save();
      return "Compartment: " + manualOverRideDto.compartment + "Manual Override for " + manualOverRideDto.timeout + " seconds.";
    } else if (manualOverRideDto.updateAll) {
      const allData = await this.racksModel.find().exec();
      allData.forEach(async compartment => {
        compartment.boxstate = manualOverRideDto.boxstate;
        compartment.manualOverRideTime = currentDate;
        compartment.manualOverRideTimeout = manualOverRideDto.timeout;
        if (manualOverRideDto.boxstate == "L")
          compartment.code = manualOverRideDto.code;
        await compartment.save();
      });
      return "ALL Compartments Manual Override for " + manualOverRideDto.timeout + " seconds.";
    }
  }

  async putApiCall(compartment, status, side) {
    if (!AppService.warehouseId) {
      console.log("No WareHouse ID is defined, please define WareHouse ID through API.");
      return;
    }
    if (status == 'available') {
      side = 'picker';
    }

    axios({
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
        "side": side,
        // "byAdmin": true
      },
    })
      .then(response => {
        // console.log(response);
        console.log("Event log Success: compartment " + compartment + " updated PUT API, Status: " + status + "  ,side: " + side);
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
  // @Cron("*/5 * * * *")
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
        // status = "occupied";
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
      axios({
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
      })
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
  @Cron("*/10 * * * * *")
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

      const lastDataReceivedDiff = currentDate.diff(element.lastDataReceivedTime, 'seconds');
      console.log(element.compartment, 'data received time ', lastDataReceivedDiff);

      if (lastDataReceivedDiff > 30) {
        element.smartenable = false;
      } else {
        element.smartenable = true;
      }

      const lastFeedbackReqDiff = currentDate.diff(element.lastFeedbackReqTime, 'seconds');
      console.log(element.compartment, 'feedback time ', lastFeedbackReqDiff);
      if (lastFeedbackReqDiff > 30) {
        element.feedbackBox = false;
      } else {
        element.feedbackBox = true;
      }

      await element.save();
    });
  }

  @Cron("*/60 * * * * *")
  async pullCloudData() {
    if (!AppService.warehouseId) {
      console.log("No WareHouse ID is defined, please define WareHouse ID through API.");
      return;
    }
    try {
      const currentDate = moment();
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
            compartmentObj.lastDataReceivedTime = currentDate;
            compartmentObj.lastFeedbackReqTime = currentDate;
            const overRideTimeDiff = moment(currentDate).diff(moment(compartmentObj.manualOverRideTime), 'seconds');
            if (overRideTimeDiff <= 0 || overRideTimeDiff > compartmentObj.manualOverRideTimeout) {
              compartmentObj.code = eachData['code'];
              compartmentObj.time = eachData['time'];
              compartmentObj.duration = eachData['duration'];
              compartmentObj.boxstate = eachData['boxstate'];
              // console.log('Updated');
            }
            await compartmentObj.save();
          } else {
            const data = new this.racksModel({
              compartment: eachData['compartment'],
              code: eachData['code'],
              time: eachData['time'],
              duration: eachData['duration'],
              boxstate: eachData['boxstate'],
              lastDataReceivedTime: currentDate,
              lastFeedbackReqTime: currentDate
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
    // console.log(state1, state2);
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

  /* Upload the data to cloud database every one minute, you can change the upload time here, read https://www.npmjs.com/package/node-cron for more information*/
  // For example to run the task every 2 minutes use @Cron('*/2 * * * * *')
  // DO NOT USE TIME OF LESS THAN ONE MINUTE BECAUSE OF TIMEMOUT TO CONNECTI WITH ATLAS MONGODB
  @Cron('*/30 * * * * *')
  async uploadDataToCloud() {
    if (!AppService.warehouseId) {
      return;
    }
    const LocalData = await this.racksModel.find().exec();
    if (!LocalData.length) {
      return 'No Local Data Found';
    }
    const compartmentsArr = [];
    LocalData.forEach(async element => {
      if (AppService.serverNum == 1 && parseInt(element.compartment.split("-")[1]) > 6) {
        return;
      } else if (AppService.serverNum == 2 && parseInt(element.compartment.split("-")[1]) <= 6) {
        return;
      }
      compartmentsArr.push(
        {
          "compartment": element.compartment,
          "boxstate": element.boxstate,
          "code": element.code,
          "livestatedisplay": element.status,
          "livestaterelay": element.relayBox,
          "livestatefeedback": element.feedbackBox,
          "smartenable": element.smartenable
        }
      );
    });
    // compartmentsArr.push({
    //   "server": {
    //     "ip": AppService.serverIP
    //   }
    // });
    const data = JSON.stringify(compartmentsArr);

    axios({
      method: 'post',
      url: `https://destratech.pythonanywhere.com/smartracks/cloud/${String(AppService.warehouseId)}/`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    })
      .then(function (response) {
        console.log("Data pushed to cloud");
      })
      .catch(function (error) {
        console.log("Data cannot be pushed to cloud");
      });
  }


  // @Cron('*/5  * * * *')
  // async updateServerForeignIp() {
  //   axios({
  //     method: 'get',
  //     url: `https://api.ipify.org/?format=json`,
  //   })
  //     .then(function (response) {
  //       if (response.data) {
  //         AppService.serverIP = response.data.ip;
  //       }
  //       console.log("Server Foreign IP", AppService.serverIP);
  //     })
  //     .catch(function (error) {
  //       console.log(error);
  //     });
  // }
}
