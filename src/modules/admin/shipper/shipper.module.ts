import { Module } from '@nestjs/common';
import { ShipperController } from './shipper.controller';
import { ShipperService } from './shipper.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';

@Module({
  controllers: [ShipperController],
  providers: [ShipperService, PrismaService, UserRepository],
})
export class ShipperModule {}
