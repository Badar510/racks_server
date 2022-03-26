import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
const axios = require('axios').default;

@Injectable()
export class AppService {
  constructor(
    @InjectModel('rack-schema') private readonly racksModel,
  ) {
    this.pullCloudData();
  }


  async pullCloudData() {
    axios.get('https://api.airliftgrocer.com/v2/orders/packed/compartments?warehouse=386')
      .then(function (response) {
        // handle success
        console.log(response);
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      })
      .then(function () {
        // always executed
      });
  }
}
