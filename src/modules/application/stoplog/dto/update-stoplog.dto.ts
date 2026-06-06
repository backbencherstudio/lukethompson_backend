import { PartialType } from '@nestjs/swagger';
import { PutStopLogDto } from './create-stoplog.dto';

export class UpdateStopLogDto extends PartialType(PutStopLogDto) {}
