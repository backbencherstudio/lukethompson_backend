import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UpdateStopLogDto } from './dto/update-stoplog.dto';
import { LogStopStep, PutStopLogDto } from './dto/create-stoplog.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseHelper } from 'src/common/helper/response.helper';
import {
  Period,
  QueryHomeDataDto,
  QueryStopLogDto,
  StopLogStatus,
} from './dto/query-stoplog.dto';
import { Prisma } from 'prisma/generated/browser';

@Injectable()
export class StopLogService {
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
              select: {
                id: true,
                arrived_at: true,
                docked_at: true,
                completed_at: true,
                departed_at: true,
              },
            })
          : await tx.stopLog.update({
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
            stop_log_id: stoplog.id,
          },
        });
      }

      return ResponseHelper.success({
        message: 'Stop log step recorded successfully',
        data: stoplog,
      });
    });
  }

  async getAllStopLogs(query: QueryStopLogDto, user_id: string) {
    const { page = 1, limit = 10, search, status = StopLogStatus.ALL } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      user_id,
    };

    if (status === StopLogStatus.PROGRESS) {
      where.departed_at = null;
    } else if (status === StopLogStatus.COMPLETED) {
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
      this.prisma.stopLog.count({ where }),
      this.prisma.stopLog.findMany({
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
        ? StopLogStatus.COMPLETED
        : StopLogStatus.PROGRESS;

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
      message: 'Stop logs fetched successfully',
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

  async getOneStopLog(id: string, user_id: string) {
    const stoplog = await this.prisma.stopLog.findUnique({
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
    if (!stoplog) throw new UnauthorizedException('Stop log not found');

    if (stoplog.current_step !== 'DEPARTURE_TIME') {
      return ResponseHelper.success({
        message: 'Stop log fetched successfully',
        data: {
          id: stoplog.id,
          arrived_at: stoplog.arrived_at,
          docked_at: stoplog.docked_at,
          completed_at: stoplog.completed_at,
          departed_at: stoplog.departed_at,
          current_step: stoplog.current_step,
        },
      });
    }

    const arrived = stoplog.arrived_at
      ? new Date(stoplog.arrived_at).getTime()
      : 0;
    const departed = stoplog.departed_at
      ? new Date(stoplog.departed_at).getTime()
      : 0;

    const totalTime =
      departed > arrived
        ? ((departed - arrived) / (1000 * 60 * 60)).toFixed(2)
        : null;

    const totalTimeNum = totalTime ? parseFloat(totalTime) : 0;
    const payableTime = Math.max(
      0,
      totalTimeNum - (stoplog.user?.free_wait_time || 0),
    );

    const payableTimeFormatted = payableTime.toFixed(2);
    const totalAmount = payableTime * (stoplog.user?.rate_per_hour || 0);

    const address = stoplog.locations?.[0]?.address || null;

    return ResponseHelper.success({
      message: 'Stop log fetched successfully',
      data: {
        id: stoplog.id,
        rate_per_hour: stoplog.user?.rate_per_hour,
        free_wait_time: stoplog.user?.free_wait_time,
        billable_time: payableTimeFormatted,
        arrival_departure_time: totalTime,
        address,
        detention: totalAmount.toFixed(2),
        lost: totalAmount.toFixed(2),
      },
    });
  }

  async getHomeData(user_id: string, query: QueryHomeDataDto) {
    const { period = Period.TODAY } = query;

    const where: Prisma.StopLogWhereInput = {
      user_id,
      departed_at: { not: null }, // Only calculate for completed stops
    };

    const now = new Date();
    switch (period) {
      case Period.TODAY:
        where.created_at = {
          gte: new Date(now.setHours(0, 0, 0, 0)),
        };
        break;
      case Period.WEEK:
        where.created_at = {
          gte: new Date(now.setDate(now.getDate() - 7)),
        };
        break;
      case Period.MONTH:
        where.created_at = {
          gte: new Date(now.setMonth(now.getMonth() - 1)),
        };
        break;
      case Period.YEAR:
        where.created_at = {
          gte: new Date(now.setFullYear(now.getFullYear() - 1)),
        };
        break;
    }

    const stopLogs = await this.prisma.stopLog.findMany({
      where,
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
    });

    let total_detention = 0;
    let total_hours = 0;
    let worstStopLogData = null;
    let maxAmount = -1;

    stopLogs.forEach((stopLog) => {
      const arrived = stopLog.arrived_at.getTime();
      const departed = stopLog.departed_at.getTime();

      const hoursDiff = Math.max(0, (departed - arrived) / (1000 * 60 * 60));
      const payableTime = Math.max(
        0,
        hoursDiff - (stopLog.user?.free_wait_time || 0),
      );
      const amount = payableTime * (stopLog.user?.rate_per_hour || 0);

      total_detention += amount;
      total_hours += payableTime;

      if (amount > maxAmount) {
        maxAmount = amount;
        worstStopLogData = {
          address: stopLog.locations?.[0]?.address || 'Unknown Address',
          total_lost: amount.toFixed(2),
        };
      }
    });

    return ResponseHelper.success({
      message: 'Home data fetched successfully',
      data: {
        total_detention: total_detention.toFixed(2),
        total_lost: total_detention.toFixed(2),
        total_hours: total_hours.toFixed(2),
        rate_per_hour: stopLogs[0]?.user?.rate_per_hour || 0,
        worst_stoplog: worstStopLogData || {
          address: null,
          total_lost: '0.00',
        },
      },
    });
  }

  async getReport(user_id: string) {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stopLogs = await this.prisma.stopLog.findMany({
      where: {
        user_id,
        departed_at: { not: null },
        created_at: { gte: lastWeek },
      },
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
    });

    let total_detention = 0;
    let total_timeloast = 0;
    let worstStopLogData = null;
    let maxAmount = -1;

    stopLogs.forEach((stopLog) => {
      const arrived = stopLog.arrived_at.getTime();
      const departed = stopLog.departed_at.getTime();

      const hoursDiff = Math.max(0, (departed - arrived) / (1000 * 60 * 60));
      const payableTime = Math.max(
        0,
        hoursDiff - (stopLog.user?.free_wait_time || 0),
      );
      const amount = payableTime * (stopLog.user?.rate_per_hour || 0);

      total_detention += amount;
      total_timeloast += payableTime;

      if (amount > maxAmount) {
        maxAmount = amount;
        worstStopLogData = {
          address: stopLog.locations?.[0]?.address || 'Unknown Address',
          total_lost: amount.toFixed(2),
        };
      }
    });

    return ResponseHelper.success({
      message: 'Weekly report fetched successfully',
      data: {
        total_stops: stopLogs.length,
        total_timeloast: total_timeloast.toFixed(2),
        total_detention: total_detention.toFixed(2),
        total_lost: total_detention.toFixed(2),
        worst_stoplog: worstStopLogData || {
          address: null,
          total_lost: '0.00',
        },
        rate_per_hour: stopLogs[0]?.user?.rate_per_hour || 0,
      },
    });
  }
}
