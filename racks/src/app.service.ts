/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-var-requires */
import { Injectable } from '@nestjs/common';
const axios = require('axios');
const fs = require('fs');
const defaultGateway = require('default-gateway');
import Bottleneck from 'bottleneck';
const limiter = new Bottleneck({
  minTime: 500,
});
const foreignApiLimiter = new Bottleneck({
  minTime: 5000,
});
const foreignApi: string =
  'https://api.airliftgrocer.com/v2/orders/packed/compartments?warehouse=386';

@Injectable()
export class AppService {
  constructor() {
    this.serverInitialize();
  }

  async serverInitialize() {
    const prevCompartmentsFile = await fs.existsSync('./prevCompartments.json');
    if (prevCompartmentsFile) {
      console.log('Removing prevCompartments file');
      await fs.unlink('./prevCompartments.json', function (err) {
        if (err) throw err;
      });
    }
    try {
      let ctr = 2;
      const { gateway } = await defaultGateway.v4();
      const gatewayArray = gateway.split('.');
      const array = [
        'A',
        'B',
        'C',
        'D'
      ];
      const numbericLength: number = 16;
      let jsonStr = '{';
      for (let i = 0; i < array.length; i++) {
        for (let j = 1; j <= numbericLength; j++) {
          jsonStr += `"${array[i]}-${j.toString().padStart(2, '0')}": "${gatewayArray[0]
            }.${gatewayArray[1]}.${gatewayArray[2]}.${ctr}"`;
          if (!(i == array.length - 1 && j == numbericLength)) {
            jsonStr += `,`;
          }
          // console.log(
          //   `"${array[i]}-0${j}": "${gatewayArray[0]}.${gatewayArray[1]}.${gatewayArray[2]}.${ctr}",`,
          // );
          ctr++;
        }
      }
      jsonStr += '}';
      await fs.writeFile('./device_ips.json', jsonStr, async (err) => {
        if (err) throw err;
        return this.initializeTask();
      });
    } catch (err) {
      console.log(err);
      foreignApiLimiter
        .schedule(() => this.serverInitialize())
        .then();
    }
  }

  async initializeTask() {
    const prevCompartmentsFile = await fs.existsSync('./prevCompartments.json');
    if (prevCompartmentsFile) {
      console.log(
        'Found previous compartments file, will update only updated compartments',
      );
      let prevData = await fs.readFileSync('./prevCompartments.json', 'utf8');
      prevData = JSON.parse(prevData);
      let device_ips = await fs.readFileSync('./device_ips.json', 'utf8');
      device_ips = JSON.parse(device_ips);
      const response = await this.getDataStagingAPI();
      if (response) {
        let responseCtr: number = 0;
        response.forEach(async (data) => {
          // console.log('response', data);
          const newCompartment = data['compartment'];
          const newCode = data['code'];
          const newBoxstate = data['boxstate'];
          let prevDataCtr: number = 0;
          prevData.forEach(async (eachPrevData) => {
            if (eachPrevData['compartment'] === newCompartment) {
              // console.log('saved', eachPrevData);
              if (
                eachPrevData['code'] !== newCode ||
                eachPrevData['boxstate'] !== newBoxstate
              ) {
                const device_ip = device_ips[data['compartment']];
                const code = data['code'];
                const boxstate = data['boxstate'];
                console.log(device_ip, code, boxstate);
                if (device_ip) {
                  limiter
                    .schedule(() =>
                      this.nodesApiCall(device_ip, code, boxstate),
                    )
                    .then(async (result) => {
                      if (result) {
                        console.log(
                          `Compartment: ${data['compartment']} | ${result.data}`,
                        );
                      }
                      const jobs = limiter.counts();
                      console.log(jobs);
                      if (
                        jobs.RECEIVED === 0 &&
                        jobs.EXECUTING === 0 &&
                        jobs.QUEUED === 0 &&
                        jobs.RUNNING === 0
                      ) {
                        console.log('All Schedules Completed');
                        fs.writeFile(
                          './prevCompartments.json',
                          JSON.stringify(response),
                          (err) => {
                            if (err) throw err;
                            return this.initializeTask();
                          },
                        );
                      }
                    });
                }
              }
            }
            if (responseCtr + 1 == response.length && prevDataCtr + 1 == prevData.length) { //Detecting if this is the last iteration 
              console.log('No changes detected, will try again later');
              foreignApiLimiter
                .schedule(() => this.initializeTask())
                .then();
            }
            prevDataCtr++;
          });
          responseCtr++;
        });
      }
    } else {
      console.log('Previous compartments file not found, creating a new one');
      const response = await this.getDataStagingAPI();
      if (response) {
        response.forEach(async (data) => {
          let device_ips = await fs.readFileSync('./device_ips.json', 'utf8');
          device_ips = JSON.parse(device_ips);
          const device_ip = device_ips[data['compartment']];
          const code = data['code'];
          const boxstate = data['boxstate'];
          if (device_ip) {
            limiter
              .schedule(() => this.nodesApiCall(device_ip, code, boxstate))
              .then(async (result) => {
                if (result) {
                  console.log(
                    `Compartment: ${data['compartment']} | ${result.data}`,
                  );
                }
                const jobs = limiter.counts();
                console.log(jobs);
                if (
                  jobs.RECEIVED === 0 &&
                  jobs.EXECUTING === 0 &&
                  jobs.QUEUED === 0 &&
                  jobs.RUNNING === 0
                ) {
                  console.log('All Schedules Completed');
                  await fs.writeFile(
                    './prevCompartments.json',
                    JSON.stringify(response),
                    (err) => {
                      if (err) throw err;
                      return this.initializeTask();
                    },
                  );
                }

              });
          }
        });
      }
    }
  }

  async getDataStagingAPI() {
    try {
      const response = await axios.get(foreignApi, {
        headers: {
          auth: 'Groc3R@Sm@rtR@ck',
        },
      });
      return response.data;
    } catch (err) {
      console.log(err);
      foreignApiLimiter
        .schedule(() => this.initializeTask())
        .then();
      return false;
    }
  }

  async nodesApiCall(device_ip, code, boxState) {
    const deviceUrl = `http://${device_ip}/racks?code=${code}&state=${boxState}`;
    try {
      const response = await axios.post(deviceUrl);
      console.log(response);
      return response.data;
    } catch (error) {
      console.error(`Device: ${device_ip} Offline`);
      return false;
    }
  }

  //Method 1
  async getStatus(query) {
    try {
      const fileData = await fs.readFileSync('./device_ips.json', 'utf8');
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
      const fileData = await fs.readFileSync('./device_ips.json', 'utf8');
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
