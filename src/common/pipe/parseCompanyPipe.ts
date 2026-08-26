import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseCompanyPipe implements PipeTransform {
  transform(value: any) {
    if (!value) return value;

    // If company is a string, parse it
    if (value.company && typeof value.company === 'string') {
      try {
        value.company = JSON.parse(value.company);
      } catch (e) {
        throw new BadRequestException(
          'Invalid company data format. Please provide valid JSON.',
        );
      }
    }

    return value;
  }
}
