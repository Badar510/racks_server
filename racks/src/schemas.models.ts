import * as mongoose from 'mongoose';

export const RackSchema = new mongoose.Schema(
    {
        compartment: { type: String, required: false },
        code: { type: String, required: false },
        time: { type: String, required: false },
        duration: { type: String, required: false },
        boxstate: { type: String, required: false },
        liveBoxstate: { type: String, required: false },
        lastSeen: { type: Date, required: false },
        status: { type: Boolean, required: false, default: false },
        relayBox: { type: Boolean, required: false, default: true },
        smartenable: { type: Boolean, required: false, default: false },
        manualOverRideTime: { type: Date, required: false },
        manualOverRideTimeout: { type: Number, required: false },
    },
    {
        timestamps: true,
    },
);