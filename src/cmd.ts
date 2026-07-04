import 'dotenv/config';
// external imports
import { Module } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';
// internal imports
import { PrismaService } from './prisma/prisma.service';
import { SeedCommand } from './command/seed.command';
import { UserRepository } from './common/repository/user/user.repository';

@Module({
  providers: [SeedCommand, PrismaService, UserRepository],
})
export class AppModule {}

async function bootstrap() {
  await CommandFactory.run(AppModule);
}

bootstrap();
