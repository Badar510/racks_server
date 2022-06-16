/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { RackSchema } from '../schemas.models';
import { Cron } from '@nestjs/schedule';
import moment from 'moment';
const axios = require('axios').default;
const fs = require('fs');

@Injectable()
export class CloudService {
    static warehouseId: string;
    constructor(@InjectModel('rack-schema') private readonly racksModel) {
        // this.uploadData();
    }
    async initializeServer() {
        //Clearing prev stored data
        try {
            let configs = await fs.readFileSync('./configs.json', 'utf8');
            configs = JSON.parse(configs);
            CloudService.warehouseId = configs["warehouseId"];
        } catch (err) { }
    }


}
