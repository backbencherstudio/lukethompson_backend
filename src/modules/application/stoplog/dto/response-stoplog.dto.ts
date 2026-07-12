import { ApiProperty } from '@nestjs/swagger';
import { ClaimSendMethod } from 'prisma/generated/enums';

// --- Record/Update Step Response ---
export class StopLogStepDataDto {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;

  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j1k' })
  shipper_facility_id: string;

  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j1k' })
  shipper_id: string;

  @ApiProperty({ example: 'Acme Warehouse' })
  shipper_name: string;

  @ApiProperty({ example: 'Acme Warehouse' })
  facility_name: string;

  @ApiProperty({ example: 'BOL-12345', required: false, nullable: true })
  bol_number?: string;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: '2026-06-28T05:27:41Z' })
  arrived_at: string;

  @ApiProperty({
    example: '2026-06-28T05:27:41Z',
    required: false,
    nullable: true,
  })
  docked_at?: string;

  @ApiProperty({
    example: '2026-06-28T05:27:41Z',
    required: false,
    nullable: true,
  })
  completed_at?: string;

  @ApiProperty({
    example: '2026-06-28T05:27:41Z',
    required: false,
    nullable: true,
  })
  departed_at?: string;

  @ApiProperty({ type: Object, required: false, nullable: true })
  arrival_location?: any;

  @ApiProperty({ type: Object, required: false, nullable: true })
  facility_address?: any;

  @ApiProperty({ type: [Object], example: [] })
  attachments: any[];

  @ApiProperty({ example: 'arrival_time' })
  current_step: string;
}

export class StopLogStepResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Stop log step recorded successfully' })
  message: string;

  @ApiProperty({ type: StopLogStepDataDto })
  data: StopLogStepDataDto;
}

// --- List Stop Logs Response ---
export class StopLogListItemDto {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;

  @ApiProperty({ example: 'Acme Warehouse' })
  facility_name: string;

  @ApiProperty({
    example: 'cl0a1b2c3d4e5f6g7h8i9j1k',
    required: false,
    nullable: true,
  })
  shipper_facility_id?: string;

  @ApiProperty({ example: '2026-06-28T05:27:41Z' })
  date: string;

  @ApiProperty({ example: '250.00' })
  amount: string;

  @ApiProperty({ example: 'COMPLETED', enum: ['COMPLETED', 'PROGRESS'] })
  status: string;

  @ApiProperty({
    example: 'DRAFT',
    enum: ['DRAFT', 'SUBMITTED', 'PAID', 'DENIED'],
    nullable: true,
    required: false,
    description: 'Status of the claim associated with the stoplog, if any',
  })
  claim_status?: string | null;

  @ApiProperty({ type: Object, required: false, nullable: true })
  rating?: {
    id: string;
    rating: number;
  } | null;
}

export class StopLogListMetaFiltersDto {
  @ApiProperty({ example: 'ALL' })
  status: string;
}

export class StopLogListMetaDto {
  @ApiProperty({
    example: 'cl0a1b2c3d4e5f6g7h8i9j0k',
    required: false,
    nullable: true,
  })
  next_cursor?: string;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 'Dhaka', required: false, nullable: true })
  search?: string;

  @ApiProperty({ type: StopLogListMetaFiltersDto })
  filters: StopLogListMetaFiltersDto;
}

export class StopLogListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Stop logs fetched successfully' })
  message: string;

  @ApiProperty({ type: [StopLogListItemDto] })
  data: StopLogListItemDto[];

  @ApiProperty({ type: StopLogListMetaDto })
  meta_data: StopLogListMetaDto;
}

// --- Driver Dashboard Metrics Response ---
export class StopLogWeeklyActivityDayDto {
  @ApiProperty({ example: 'Mon' })
  day: string;

  @ApiProperty({ example: 2 })
  total_stops: number;
}

export class StopLogWeeklyActivityDto {
  @ApiProperty({ example: 10 })
  total_stops: number;

  @ApiProperty({ type: [StopLogWeeklyActivityDayDto] })
  data: StopLogWeeklyActivityDayDto[];
}

export class StopLogHomeDataDto {
  @ApiProperty({ example: '225.00' })
  total_detention: string;

  @ApiProperty({ example: '225.00' })
  total_lost: string;

  @ApiProperty({ example: 6 })
  total_stops: number;

  @ApiProperty({ example: 3 })
  claimed_stops: number;

  @ApiProperty({ example: '14.50' })
  total_hours: string;

  @ApiProperty({ example: '2.42' })
  avg_hours_per_stop: string;

  @ApiProperty({ example: '2h 25m' })
  avg_hours_per_stop_text: string;

  @ApiProperty({ example: '68.00' })
  collection_rate: string;

  @ApiProperty({ example: '12.00' })
  collection_rate_change: string;

  @ApiProperty({ type: StopLogWeeklyActivityDto })
  weekly_activity: StopLogWeeklyActivityDto;
}

export class StopLogHomeResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Home data fetched successfully' })
  message: string;

  @ApiProperty({ type: StopLogHomeDataDto })
  data: StopLogHomeDataDto;
}

// --- Reports Response ---
export class StopLogWorstStopDto {
  @ApiProperty({
    example: 'Cold Storage Solutions',
    required: false,
    nullable: true,
  })
  facility_name?: string;

  @ApiProperty({ example: '3.00' })
  waiting_hours: string;

  @ApiProperty({ example: '3h 0m' })
  waiting_time_text: string;
}

export class StopLogWeeklySummaryDto {
  @ApiProperty({ example: 'WEEKLY_SUMMARY' })
  tab: string;

  @ApiProperty({ example: '14.50' })
  total_waiting_hours: string;

  @ApiProperty({ example: '14h 30m' })
  total_waiting_text: string;

  @ApiProperty({ example: '225.00' })
  detention_captured: string;

  @ApiProperty({ example: '25.00' })
  revenue_lost: string;

  @ApiProperty({ type: StopLogWorstStopDto })
  top_worst_stop: StopLogWorstStopDto;
}

export class StopLogDateRangeDto {
  @ApiProperty({ example: '2026-06-28T05:27:41Z' })
  start: string;

  @ApiProperty({ example: '2026-06-28T05:27:41Z' })
  end: string;
}

export class StopLogRevenueRealizationDto {
  @ApiProperty({ example: 'Jan' })
  label: string;

  @ApiProperty({ example: '400.00' })
  claimed: string;

  @ApiProperty({ example: '325.00' })
  collected: string;
}

export class StopLogTaxReportDto {
  @ApiProperty({ example: 'TAX_REPORT' })
  tab: string;

  @ApiProperty({ example: 'MONTHLY', enum: ['MONTHLY', 'YEARLY'] })
  period: string;

  @ApiProperty({ type: StopLogDateRangeDto })
  date_range: StopLogDateRangeDto;

  @ApiProperty({ example: '600.00' })
  total_claimed: string;

  @ApiProperty({ example: '225.00' })
  total_collected: string;

  @ApiProperty({ example: '45.00' })
  collection_rate: string;

  @ApiProperty({ example: '25.00' })
  avg_days_to_pay: string;

  @ApiProperty({ example: '25 days' })
  avg_days_to_pay_text: string;

  @ApiProperty({ example: '375.00' })
  revenue_lost: string;

  @ApiProperty({ type: [StopLogRevenueRealizationDto] })
  revenue_realization: StopLogRevenueRealizationDto[];
}

export class StopLogReportResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Weekly summary fetched successfully' })
  message: string;

  @ApiProperty({
    oneOf: [
      { $ref: '#/components/schemas/StopLogWeeklySummaryDto' },
      { $ref: '#/components/schemas/StopLogTaxReportDto' },
    ],
  })
  data: StopLogWeeklySummaryDto | StopLogTaxReportDto;
}

// --- Single Stop Log Details Response ---
export class StopLogDetailInProgressDto {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;

  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  user_id: string;

  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  shipper_facility_id: string;

  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  shipper_id: string;

  @ApiProperty({ example: 'Acme Shipper' })
  shipper_name: string;

  @ApiProperty({ example: 'Warehouse A' })
  facility_name: string;

  @ApiProperty({ example: 'BOL-123', required: false, nullable: true })
  bol_number?: string;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: '2026-06-28T05:27:41Z' })
  arrived_at: string;

  @ApiProperty({
    example: '2026-06-28T05:27:41Z',
    required: false,
    nullable: true,
  })
  docked_at?: string;

  @ApiProperty({
    example: '2026-06-28T05:27:41Z',
    required: false,
    nullable: true,
  })
  completed_at?: string;

  @ApiProperty({
    example: '2026-06-28T05:27:41Z',
    required: false,
    nullable: true,
  })
  departed_at?: string;

  @ApiProperty({ type: Object, required: false, nullable: true })
  arrival_location?: any;

  @ApiProperty({ type: Object, required: false, nullable: true })
  facility_address?: any;

  @ApiProperty({ type: Object, required: false, nullable: true })
  detention_summary_pdf?: any;

  @ApiProperty({ type: [Object], example: [] })
  attachments: any[];

  @ApiProperty({ example: 'arrival_time' })
  current_step: string;
}

export class StopLogDetailClaimDto {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;

  @ApiProperty({
    example: 'DRAFT',
    enum: ['DRAFT', 'SUBMITTED', 'PAID', 'DENIED'],
  })
  status: string;

  @ApiProperty({ example: 250 })
  amount: number;

  @ApiProperty({
    example: 0,
    description:
      'Current recourse step / level (e.g. 0 = initial, 1 = followup, etc.)',
  })
  level: number;

  @ApiProperty({
    example: 'Draft / Initial Claim',
    description: 'Name of the current recourse level',
  })
  level_name: string;

  @ApiProperty({ example: 1, description: 'Number of follow-ups sent' })
  followup_count: number;

  @ApiProperty({
    example: 'MAIL',
    enum: ['MAIL', 'SMS'],
    description:
      'Method used to send the claim: MAIL (email), SMS (text message), or null if claim was manually generated.',
    nullable: true,
  })
  send_method: ClaimSendMethod | null;

  @ApiProperty({
    example: '2026-06-28T05:27:41.000Z',
    description:
      'The timestamp when the claim was sent/submitted, or null if not sent yet.',
    nullable: true,
  })
  sent_at: Date | null;
}

export class StopLogDetailCompletedDto {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;

  @ApiProperty({ example: 'COMPLETED' })
  status: string;

  @ApiProperty({ example: 'Warehouse A' })
  facility_name: string;

  @ApiProperty({ example: '2026-06-28T05:27:41Z' })
  arrived_at: string;

  @ApiProperty({ example: '2026-06-28T05:27:41Z' })
  departed_at: string;

  @ApiProperty({ example: 'BOL-123', required: false, nullable: true })
  bol_number?: string;

  @ApiProperty({
    example: '32.1221, -112.1221',
    required: false,
    nullable: true,
  })
  gps_coordinates?: string;

  @ApiProperty({ example: 100 })
  rate_per_hour: number;

  @ApiProperty({ example: 2 })
  free_wait_time: number;

  @ApiProperty({ example: '2.50' })
  billable_time: string;

  @ApiProperty({ example: '2h 30m' })
  billable_time_text: string;

  @ApiProperty({ example: '5.90' })
  arrival_departure_time: string;

  @ApiProperty({ example: 'Warehouse A', required: false, nullable: true })
  address?: string;

  @ApiProperty({ example: '250.00' })
  detention: string;

  @ApiProperty({ example: '250.00' })
  lost: string;

  @ApiProperty({ type: Object, required: false, nullable: true })
  detention_summary_pdf?: any;

  @ApiProperty({ type: [Object], example: [] })
  attachments: any[];

  @ApiProperty({
    type: StopLogDetailClaimDto,
    required: false,
    nullable: true,
    description: 'Claim status details if generated, otherwise null',
  })
  claim?: StopLogDetailClaimDto | null;
}

export class StopLogDetailResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Stop log fetched successfully' })
  message: string;

  @ApiProperty({
    oneOf: [
      { $ref: '#/components/schemas/StopLogDetailInProgressDto' },
      { $ref: '#/components/schemas/StopLogDetailCompletedDto' },
    ],
  })
  data: StopLogDetailInProgressDto | StopLogDetailCompletedDto;
}

export class StopLogActiveDataDto {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;
}

export class StopLogActiveResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Active stop log fetched successfully' })
  message: string;

  @ApiProperty({ type: StopLogActiveDataDto, nullable: true })
  data: StopLogActiveDataDto | null;
}
