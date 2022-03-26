import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { RackSchema } from './schemas.models';

@Module({
  imports: [MongooseModule.forRoot('mongodb://localhost/nest'),
  MongooseModule.forFeature([
    { name: 'rack-schema', schema: RackSchema },
  ]),
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
