import { Injectable } from '@nestjs/common';
import { response } from 'express';
const axios = require('axios');
const fs = require('fs');
let timeInterval = 10; // in secon
const defaultGateway = require('default-gateway');

@Injectable()
export class AppService {
  constructor() {
    this.saveJsonAndCallStagingAPI();
  }

  async saveJsonAndCallStagingAPI() {
    let ctr = 2;
    const { gateway } = await defaultGateway.v4();
    const gatewayArray = gateway.split('.');
    let array = [
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
      'I',
      'J',
      'K',
      'L',
      'M',
    ];
    let jsonStr = '{';
    for (let i = 0; i < array.length; i++) {
      for (let j = 1; j <= 8; j++) {
        jsonStr += `"${array[i]}-0${j}": "${gatewayArray[0]}.${gatewayArray[1]}.${gatewayArray[2]}.${ctr}"`;
        if (!(i == array.length - 1 && j == 8)) {
          jsonStr += `,`;
        }
        // console.log(
        //   `"${array[i]}-0${j}": "${gatewayArray[0]}.${gatewayArray[1]}.${gatewayArray[2]}.${ctr}",`,
        // );
        ctr++;
      }
    }
    jsonStr += '}';

    await fs.writeFile('./src/device_ips.json', jsonStr, (err) => {
      if (err) throw err;
    });
    this.getDataStagingAPI();
  }

  async getDataStagingAPI() {
    async function apiCall() {
      try {
        const response = await axios.get(
          'https://stagingapi.grocery.rideairlift.com/v2/orders/packed/compartments?warehouse=37',
          {
            headers: {
              auth: 'Groc3R@Sm@rtR@ck',
            },
          },
          
        );
        console.log(response);
        const allData = response.data;
        allData.forEach(async (obj) => {
          const fileData = fs.readFileSync('./src/device_ips.json', 'utf8');
          const device_ips = JSON.parse(fileData);
          const device_ip = device_ips[obj['compartment']];

          const getValuesUrl = `http://${device_ip}/racks?code=${obj['code']}&state=${obj['boxstate']}`;
          try {
            const response = await axios.post(getValuesUrl);
            return response.data;
          } catch (error) {
            console.error(error);
            return error;
          }
        });

        return response.data;
      } catch (error) {
        console.error(error);
        return error;
      }
    }
    setInterval(apiCall, timeInterval * 1000);
  }

  async getStatus(query) {
    try {
      const fileData = fs.readFileSync('./src/device_ips.json', 'utf8');
      const device_ips = JSON.parse(fileData);
      const device_id = query.device_id;
      const device_ip = device_ips[device_id];
      const getValuesUrl = `http://${device_ip}/getValues`;
      try {
        const response = await axios.get(getValuesUrl);
        return response.data;
      } catch (error) {
        console.error(error);
        return error;
      }
    } catch (error) {
      console.error(error);
      return error;
    }
  }

  async changeStatus(query) {
    try {
      const fileData = fs.readFileSync('./src/device_ips.json', 'utf8');
      const device_ips = JSON.parse(fileData);
      const device_id = query.device_id;
      const lock = query.lock;
      const otp = query.otp;
      const device_ip = device_ips[device_id];
      const getValuesUrl = `http://${device_ip}/lock${lock}?otp=${otp}`;
      try {
        const response = await axios.post(getValuesUrl);
        return response.data;
      } catch (error) {
        console.error(error);
        return error;
      }
    } catch (error) {
      console.error(error);
      return error;
    }
  }
}
