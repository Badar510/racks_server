/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { RackSchema } from '../schemas.models';
import { Cron } from '@nestjs/schedule';
import moment from 'moment';
const fs = require('fs');

@Injectable()
export class CloudService {
    static warehouseId: string;
    constructor(@InjectModel('rack-schema') private readonly racksModel) {
        this.initializeServer();
    }
    async initializeServer() {
        //Clearing prev stored data
        const allData = await this.racksModel.find().exec();
        allData.forEach(async element => {
            await element.delete();
        });

        try {
            let configs = await fs.readFileSync('./configs.json', 'utf8');
            configs = JSON.parse(configs);
            CloudService.warehouseId = configs["warehouseId"];
        } catch (err) { }
    }

    /* Upload the data to cloud database every one minute, you can change the upload time here, read https://www.npmjs.com/package/node-cron for more information*/
    // For example to run the task every 2 minutes use @Cron('*/2 * * * * *')
    // DO NOT USE TIME OF LESS THAN ONE MINUTE BECAUSE OF TIMEMOUT TO CONNECTI WITH ATLAS MONGODB
    @Cron('1 * * * * *')
    async handleCron() {
        const response = await this.uploadData();
        console.log(response);
    }

    async uploadData() {
        try {
            if (!CloudService.warehouseId) {
                return;
            }
            const LocalData = await this.racksModel.find().exec();
            if (!LocalData.length) {
                return 'No Local Data Found';
            }
            await mongoose.connect(
                `mongodb+srv://Salik:JFAVPkCgW8mtXRN@cluster0.p1m4g.mongodb.net/warehouse${CloudService.warehouseId}?retryWrites=true&w=majority`,
            );
            if (mongoose.connection.readyState === 1) {
                const cloudDataModel = mongoose.model('compartmentsInfo', RackSchema);
                const warehouseInfo = mongoose.model('warehouseInfo', RackSchema);
                // const allCloudCompartments = await cloudDataModel.find().exec();
                // allCloudCompartments.forEach(async comparment => {
                //     await comparment.delete();
                // });
                // return 
                const allCompartments = await this.racksModel.find().exec();
                allCompartments.forEach(async comparment => {
                    const prevCompartment = await cloudDataModel.findOne({ comparment: comparment }).exec();
                    if (prevCompartment) {
                        prevCompartment['code'] = comparment.code;
                        prevCompartment['time'] = comparment.time;
                        prevCompartment['duration'] = comparment.duration;
                        prevCompartment['boxstate'] = comparment.boxstate;
                        prevCompartment['liveBoxstate'] = comparment.liveBoxstate;
                        prevCompartment['lastSeen'] = comparment.lastSeen;
                        prevCompartment['lastSeenEventController'] = comparment.lastSeenEventController;
                        prevCompartment['status'] = comparment.status;
                        prevCompartment['statusEventController'] = comparment.statusEventController;
                        prevCompartment['manualOverRideTime'] = comparment.manualOverRideTime;
                        prevCompartment['manualOverRideTimeout'] = comparment.manualOverRideTimeout;
                        await prevCompartment.save();
                        // console.log("Updated cloud compartment");
                    } else {
                        const newData = new cloudDataModel({
                            compartment: comparment.compartment,
                            code: comparment.code,
                            time: comparment.time,
                            duration: comparment.duration,
                            boxstate: comparment.boxstate,
                            liveBoxstate: comparment.liveBoxstate,
                            lastSeen: comparment.lastSeen,
                            status: comparment.status,
                            manualOverRideTime: comparment.manualOverRideTime,
                            manualOverRideTimeout: comparment.manualOverRideTimeout,
                        });
                        newData.save();
                        // console.log("Created new cloud compartment");
                    }
                    const prevWarehouse = await warehouseInfo.findOne({ warehouseId: CloudService.warehouseId }).exec();
                    if (prevWarehouse) {
                        prevWarehouse['lastUpdated'] = moment();
                    } else {
                        const newData = new warehouseInfo({
                            lastUpdated: moment(),
                        });
                        newData.save();
                    }
                });
                return 'Data Uploaded Successfully';
            } else {
                return 'Unable to connect with Cloud DB';
            }
        } catch (err) {
            return err.message;
        }
    }
}
