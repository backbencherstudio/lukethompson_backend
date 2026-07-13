import { PartialType } from '@nestjs/swagger';
import { AdminCreateContactDto } from './create-contact.dto';

export class UpdateContactDto extends PartialType(AdminCreateContactDto) {}
