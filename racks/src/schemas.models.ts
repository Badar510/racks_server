import * as mongoose from 'mongoose';

export const RackSchema = new mongoose.Schema(
    {
        compartment: { type: String, required: false },
        code: { type: String, required: false },
        time: { type: String, required: false },
        duration: { type: String, required: false },
        boxstate: { type: String, required: false },
        lastUpdated: { type: String, required: false },
        status: { type: String, required: false },
    },
    {
        timestamps: true,
    },
);