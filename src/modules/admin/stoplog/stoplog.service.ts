import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateStopLogDto } from './dto/create-stoplog.dto';
import { UpdateStopLogDto } from './dto/update-stoplog.dto';
import { LogStopStep, PutStopLogDto } from '../../application/stoplog/dto/create-stoplog.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StopLogService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly STEP_CONFIG = {
    [LogStopStep.ARRIVAL_TIME]: { prev: null, field: 'arrived_at' },
    [LogStopStep.DOCK_IN_TIME]: { prev: 'ARRIVAL_TIME', field: 'docked_at' },
    [LogStopStep.COMPLETED_TIME]: { prev: 'DOCK_IN_TIME', field: 'completed_at' },
    [LogStopStep.DEPARTURE_TIME]: { prev: 'COMPLETED_TIME', field: 'departed_at' },
  };

  async putStopLogDto(dto: PutStopLogDto, user_id: string) {
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
      const activeLog = await tx.stopLog.findFirst({
        where: { user_id, departed_at: null },
        orderBy: { created_at: 'desc' },
      });

      // 3. Sequence & State Validation
      if (config.prev === null) {
        if (activeLog)
          throw new UnauthorizedException(
            'An active stop log is already in progress',
          );
      } else {
        if (!activeLog)
          throw new UnauthorizedException(
            'No active stop log found. Start with Arrival.',
          );
        if (activeLog.current_step !== config.prev) {
          throw new UnauthorizedException(
            `Invalid sequence. Next step should be: ${config.prev.toLowerCase()}`,
          );
        }
      }

      // 4. Update or Create Log
      const now = new Date();
      const stoplog =
        config.prev === null
          ? await tx.stopLog.create({
              data: { user_id, arrived_at: now, current_step: prismaStep },
            })
          : await tx.stopLog.update({
              where: { id: activeLog.id },
              data: { [config.field]: now, current_step: prismaStep },
            });

      // 5. Save Location
      if (dto.location) {
        await tx.location.create({
          data: {
            ...dto.location,
            location_at: prismaStep,
            stop_log_id: stoplog.id,
          },
        });
      }

      return stoplog;
    });
  }

  create(createStopLogDto: CreateStopLogDto) {
    return 'This action adds a new stoplog';
  }

  findAll() {
    return `This action returns all stoplog`;
  }

  findOne(id: number) {
    return `This action returns a #${id} stoplog`;
  }

  update(id: number, updateStopLogDto: UpdateStopLogDto) {
    return `This action updates a #${id} stoplog`;
  }

  remove(id: number) {
    return `This action removes a #${id} stoplog`;
  }
}



