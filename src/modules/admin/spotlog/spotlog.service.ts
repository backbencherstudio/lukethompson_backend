import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateSpotlogDto } from './dto/create-spotlog.dto';
import { UpdateSpotlogDto } from './dto/update-spotlog.dto';
import { LogStopStep, PutSpotLogDto } from '../../application/spotlog/dto/create-spotlog.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SpotlogService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly STEP_CONFIG = {
    [LogStopStep.ARRIVAL_TIME]: { prev: null, field: 'arrived_at' },
    [LogStopStep.DOCK_IN_TIME]: { prev: 'ARRIVAL_TIME', field: 'docked_at' },
    [LogStopStep.COMPLETED_TIME]: { prev: 'DOCK_IN_TIME', field: 'completed_at' },
    [LogStopStep.DEPARTURE_TIME]: { prev: 'COMPLETED_TIME', field: 'departed_at' },
  };

  async putSpotLogDto(dto: PutSpotLogDto, user_id: string) {
    const config = this.STEP_CONFIG[dto.step];
    const prismaStep = dto.step.toUpperCase() as any;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Validate User
      const user = await tx.user.findUnique({
        where: { id: user_id },
        select: { id: true },
      });
      if (!user) throw new UnauthorizedException('User not found');

      // 2. Find active log
      const activeLog = await tx.spotLog.findFirst({
        where: { user_id, departed_at: null },
        orderBy: { created_at: 'desc' },
      });

      // 3. Sequence & State Validation
      if (config.prev === null) {
        if (activeLog)
          throw new UnauthorizedException(
            'An active spot log is already in progress',
          );
      } else {
        if (!activeLog)
          throw new UnauthorizedException(
            'No active spot log found. Start with Arrival.',
          );
        if (activeLog.current_step !== config.prev) {
          throw new UnauthorizedException(
            `Invalid sequence. Next step should be: ${config.prev.toLowerCase()}`,
          );
        }
      }

      // 4. Update or Create Log
      const now = new Date();
      const spotLog =
        config.prev === null
          ? await tx.spotLog.create({
              data: { user_id, arrived_at: now, current_step: prismaStep },
            })
          : await tx.spotLog.update({
              where: { id: activeLog.id },
              data: { [config.field]: now, current_step: prismaStep },
            });

      // 5. Save Location
      if (dto.location) {
        await tx.location.create({
          data: {
            ...dto.location,
            location_at: prismaStep,
            spot_log_id: spotLog.id,
          },
        });
      }

      return spotLog;
    });
  }

  create(createSpotlogDto: CreateSpotlogDto) {
    return 'This action adds a new spotlog';
  }

  findAll() {
    return `This action returns all spotlog`;
  }

  findOne(id: number) {
    return `This action returns a #${id} spotlog`;
  }

  update(id: number, updateSpotlogDto: UpdateSpotlogDto) {
    return `This action updates a #${id} spotlog`;
  }

  remove(id: number) {
    return `This action removes a #${id} spotlog`;
  }
}
