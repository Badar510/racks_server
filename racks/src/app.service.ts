import { Injectable } from '@nestjs/common';
const axios = require('axios');
const fs = require('fs');

@Injectable()
export class AppService {
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
}
