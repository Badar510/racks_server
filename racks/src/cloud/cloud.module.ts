import { Module } from '@nestjs/common';
import { CloudController } from './cloud.controller';
import { CloudService } from './cloud.service';
import { MongooseModule } from '@nestjs/mongoose';
import { RackSchema } from '../schemas.models';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'rack-schema', schema: RackSchema }]),
  ],
  controllers: [CloudController],
  providers: [CloudService]
})
export class CloudModule { }
