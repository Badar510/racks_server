import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { RackSchema } from './schemas.models';
import { ScheduleModule } from '@nestjs/schedule';
import { CloudModule } from './cloud/cloud.module';


//Cloud DB   mongodb+srv://Salik:JFAVPkCgW8mtXRN@cluster0.p1m4g.mongodb.net/rack?retryWrites=true&w=majority
@Module({
  imports: [MongooseModule.forRoot('mongodb://localhost/nest'),
  MongooseModule.forFeature([
    { name: 'rack-schema', schema: RackSchema },
  ]),
    CloudModule,
  ScheduleModule.forRoot(),
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
