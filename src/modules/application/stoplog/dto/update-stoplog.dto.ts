import { PartialType } from '@nestjs/swagger';
import { CreateStopLogDto } from './create-stoplog.dto';

export class UpdateStopLogDto extends PartialType(CreateStopLogDto) {}



