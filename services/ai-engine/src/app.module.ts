import { Module } from '@nestjs/common';
import { InferenceController } from './inference.controller';
import { InferenceService } from './inference.service';

@Module({
  controllers: [InferenceController],
  providers: [InferenceService],
})
export class AppModule {}
