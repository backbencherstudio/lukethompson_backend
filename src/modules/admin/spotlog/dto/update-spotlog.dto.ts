import { PartialType } from '@nestjs/swagger';
import { CreateSpotlogDto } from './create-spotlog.dto';

export class UpdateSpotlogDto extends PartialType(CreateSpotlogDto) {}
