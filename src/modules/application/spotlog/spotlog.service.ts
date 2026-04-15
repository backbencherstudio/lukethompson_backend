import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UpdateSpotlogDto } from './dto/update-spotlog.dto';
import { LogStopStep, PutSpotLogDto } from './dto/create-spotlog.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseHelper } from 'src/common/helper/response.helper';
import { QuerySpotLogDto, SpotLogStatus } from './dto/query-spotlog.dto';

@Injectable()
export class SpotlogService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly STEP_CONFIG = {
    [LogStopStep.ARRIVAL_TIME]: { prev: null, field: 'arrived_at' },
    [LogStopStep.DOCK_IN_TIME]: { prev: 'ARRIVAL_TIME', field: 'docked_at' },
    [LogStopStep.COMPLETED_TIME]: {
      prev: 'DOCK_IN_TIME',
      field: 'completed_at',
    },
    [LogStopStep.DEPARTURE_TIME]: {
      prev: 'COMPLETED_TIME',
      field: 'departed_at',
    },
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
              select: {
                id: true,
                arrived_at: true,
                docked_at: true,
                completed_at: true,
                departed_at: true,
              },
            })
          : await tx.spotLog.update({
              where: { id: activeLog.id },
              data: { [config.field]: now, current_step: prismaStep },
              select: {
                id: true,
                arrived_at: true,
                docked_at: true,
                completed_at: true,
                departed_at: true,
              },
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

      return ResponseHelper.success({
        message: 'Spot log step recorded successfully',
        data: spotLog,
      });
    });
  }

  async getAllSpotLogs(query: QuerySpotLogDto, user_id: string) {
    const { page = 1, limit = 10, search, status = SpotLogStatus.ALL } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      user_id,
    };

    if (status === SpotLogStatus.PROGRESS) {
      where.departed_at = null;
    } else if (status === SpotLogStatus.COMPLETED) {
      where.departed_at = { not: null };
    }

    if (search) {
      where.locations = {
        some: {
          OR: [
            { city: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.spotLog.count({ where }),
      this.prisma.spotLog.findMany({
        where,
        skip: Number(skip),
        take: Number(limit),
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              rate_per_hour: true,
              free_wait_time: true,
            },
          },
          locations: {
            take: 1,
          },
        },
      }),
    ]);

    const getHHMM = (date: Date) =>
      new Date(date).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });

    const formattedData = data.map((item: any) => {
      const arrived = item.arrived_at ? new Date(item.arrived_at).getTime() : 0;
      const departed = item.departed_at
        ? new Date(item.departed_at).getTime()
        : 0;

      const totalTime =
        departed > arrived
          ? ((departed - arrived) / (1000 * 60 * 60)).toFixed(2)
          : null;

      const totalTimeNum = totalTime ? parseFloat(totalTime) : 0;
      const payableTime = Math.max(
        0,
        totalTimeNum - (item.user?.free_wait_time || 0),
      );

      const payableTimeFormatted = payableTime.toFixed(2);
      const totalAmount = payableTime * (item.user?.rate_per_hour || 0);

      const address = item.locations?.[0]?.address || null;

      const status = item.departed_at
        ? SpotLogStatus.COMPLETED
        : SpotLogStatus.PROGRESS;

      return {
        id: item.id,
        arrived_at: item.arrived_at ? getHHMM(item.arrived_at) : null,
        departed_at: item.departed_at ? getHHMM(item.departed_at) : null,
        total_time: totalTime,
        billable_time: payableTimeFormatted,
        detention: totalAmount.toFixed(2),
        lost: totalAmount.toFixed(2),
        address,
        status,
      };
    });

    return ResponseHelper.success({
      message: 'Spot logs fetched successfully',
      data: formattedData,
      meta_data: {
        total,
        page: Number(page),
        limit: Number(limit),
        search,
        filters: {
          status,
        },
      },
    });
  }

  async getOneSpotLog(id: string, user_id: string) {
    const spotLog = await this.prisma.spotLog.findUnique({
      where: { id, user_id },
      include: {
        user: {
          select: {
            rate_per_hour: true,
            free_wait_time: true,
          },
        },
        locations: true,
      },
    });
    if (!spotLog) throw new UnauthorizedException('Spot log not found');

    if (spotLog.current_step !== 'DEPARTURE_TIME') {
      return ResponseHelper.success({
        message: 'Spot log fetched successfully',
        data: {
          id: spotLog.id,
          arrived_at: spotLog.arrived_at,
          docked_at: spotLog.docked_at,
          completed_at: spotLog.completed_at,
          departed_at: spotLog.departed_at,
          current_step: spotLog.current_step,
        },
      });
    }

    const arrived = spotLog.arrived_at
      ? new Date(spotLog.arrived_at).getTime()
      : 0;
    const departed = spotLog.departed_at
      ? new Date(spotLog.departed_at).getTime()
      : 0;

    const totalTime =
      departed > arrived
        ? ((departed - arrived) / (1000 * 60 * 60)).toFixed(2)
        : null;

    const totalTimeNum = totalTime ? parseFloat(totalTime) : 0;
    const payableTime = Math.max(
      0,
      totalTimeNum - (spotLog.user?.free_wait_time || 0),
    );

    const payableTimeFormatted = payableTime.toFixed(2);
    const totalAmount = payableTime * (spotLog.user?.rate_per_hour || 0);

    const address = spotLog.locations?.[0]?.address || null;

    return ResponseHelper.success({
      message: 'Spot log fetched successfully',
      data: {
        id: spotLog.id,
        rate_per_hour: spotLog.user?.rate_per_hour,
        free_wait_time: spotLog.user?.free_wait_time,
        billable_time: payableTimeFormatted,
        arrival_departure_time: totalTime,
        address,
        detention: totalAmount.toFixed(2),
        lost: totalAmount.toFixed(2),
      },
    });
  }

  update(id: number, updateSpotlogDto: UpdateSpotlogDto) {
    return `This action updates a #${id} spotlog`;
  }

  remove(id: number) {
    return `This action removes a #${id} spotlog`;
  }
}
