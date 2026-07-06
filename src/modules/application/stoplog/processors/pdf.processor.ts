import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { AttachmentType } from 'prisma/generated/client';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import * as puppeteer from 'puppeteer';
import * as ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';

@Processor('pdf-queue')
export class PdfProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}...`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} with name ${job.name} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} with name ${job.name} failed with error: ${error.message}`);
  }

  async process(job: Job): Promise<any> {
    const { stopLogId, claimId } = job.data;

    this.logger.log(`Processing PDF generation for stopLogId: ${stopLogId}, claimId: ${claimId}`);

    const stoplog = await this.prisma.stopLog.findUnique({
      where: { id: stopLogId },
      include: {
        user: true,
        arrival_location: true,
        facility_address: true,
        attachments: true,
      },
    });

    if (!stoplog) {
      this.logger.error(`StopLog with ID ${stopLogId} not found`);
      return;
    }

    if (!stoplog.departed_at) {
      this.logger.error(`StopLog with ID ${stopLogId} does not have departed_at timestamp`);
      return;
    }

    try {
      // Calculate times and claim amount
      const arrived = new Date(stoplog.arrived_at).getTime();
      const departed = new Date(stoplog.departed_at).getTime();
      const totalTime = Math.max(0, (departed - arrived) / (1000 * 60 * 60));
      const payableTime = Math.max(0, totalTime - (stoplog.user?.free_wait_time || 0));
      const totalAmount = payableTime * (stoplog.user?.rate_per_hour || 0);

      // Formatting helper functions
      const formatDuration = (hoursDecimal: number): string => {
        const hours = Math.floor(hoursDecimal);
        const minutes = Math.round((hoursDecimal - hours) * 60);
        if (hours > 0 && minutes > 0) {
          return `${hours}h ${minutes}m`;
        } else if (hours > 0) {
          return `${hours}h`;
        } else {
          return `${minutes}m`;
        }
      };

      const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      };

      // Get list of other attachments for Proof Package links
      const otherAttachments = stoplog.attachments
        .filter((att) => att.type !== AttachmentType.DETENTION_SUMMARY)
        .map((att) => ({
          file_name: att.file_name || 'Attachment',
          file_url: NajimStorage.url(att.file_url),
        }));

      const gpsStr =
        stoplog.arrival_location?.lat && stoplog.arrival_location?.lng
          ? `${Number(stoplog.arrival_location.lat).toFixed(4)}, ${Number(stoplog.arrival_location.lng).toFixed(4)}`
          : 'N/A';

      const claimAmountFormatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Math.round(totalAmount));

      // Resolve templates directory path (supports dev / dist production compilation)
      const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(process.cwd(), 'dist'));
      const templatesDir = isProd
        ? path.join(process.cwd(), 'dist/mail/templates')
        : path.join(process.cwd(), 'src/mail/templates');
      
      const templatePath = path.join(templatesDir, 'detention-summary.ejs');
      if (!fs.existsSync(templatePath)) {
        throw new Error(`EJS Template file not found at: ${templatePath}`);
      }

      const templateHtml = fs.readFileSync(templatePath, 'utf-8');

      // Compile/Render EJS template to HTML
      const html = ejs.render(templateHtml, {
        claimAmount: claimAmountFormatted,
        billableDurationStr: formatDuration(payableTime),
        detentionRate: stoplog.user?.rate_per_hour || 0,
        freeWaitTimeStr: formatDuration(stoplog.user?.free_wait_time || 0),
        facilityName: stoplog.facility_name,
        arrivalTimeStr: formatTime(stoplog.arrived_at),
        departureTimeStr: formatTime(stoplog.departed_at),
        bolNumber: stoplog.bol_number,
        gpsStr,
        attachments: otherAttachments,
      });

      // Generate PDF buffer using Puppeteer
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });
      let pdfBuffer: Buffer;
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const rawPdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20px',
            bottom: '20px',
            left: '20px',
            right: '20px',
          },
        });
        pdfBuffer = Buffer.from(rawPdf);
      } finally {
        await browser.close();
      }

      // Upload generated PDF file
      const fileName = `detention-summary-${stoplog.id}.pdf`;
      const objectKey = `${appConfig().storageUrl.stopLog}/${fileName}`;
      await NajimStorage.put(objectKey, pdfBuffer);

      // Perform DB transactions: delete old summary PDF and insert new one
      await this.prisma.$transaction(async (tx) => {
        const existingSummary = await tx.attachment.findFirst({
          where: {
            stop_log_id: stoplog.id,
            type: AttachmentType.DETENTION_SUMMARY,
          },
        });

        if (existingSummary) {
          try {
            await NajimStorage.delete(existingSummary.file_url);
          } catch (err) {
            this.logger.error(`Failed to delete old summary PDF from storage: ${err.message}`);
          }
          await tx.attachment.delete({
            where: { id: existingSummary.id },
          });
        }

        await tx.attachment.create({
          data: {
            type: AttachmentType.DETENTION_SUMMARY,
            file_url: objectKey,
            file_name: fileName,
            mime_type: 'application/pdf',
            size_bytes: pdfBuffer.length,
            stop_log_id: stoplog.id,
            claim_id: claimId,
          },
        });
      });

      this.logger.log(`Detention summary PDF generated and attached successfully for stoplog: ${stoplog.id}`);
    } catch (error) {
      this.logger.error(`Error generating summary PDF for stoplog ${stoplog.id}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
