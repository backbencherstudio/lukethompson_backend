import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { RevenueCatWebhookService } from './revenuecat-webhook.service';
import { Public } from 'src/common/guard/public/public.decorator';

@Controller('payment/revenuecat')
export class RevenueCatWebhookController {
  constructor(
    private readonly revenueCatWebhookService: RevenueCatWebhookService,
  ) {}

  @Post('webhook')
  @Public()
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    try {
      // RevenueCat sends the webhook as a raw JSON body
      const event = req.body;

      // Log the raw event
      console.log('📦 RevenueCat Webhook Received:');
      console.log('Headers:', req.headers);
      console.log('Event:', JSON.stringify(event, null, 2));

      // Process the webhook event (just console logging for now)
      await this.revenueCatWebhookService.processWebhook(event);

      // RevenueCat expects a 200 OK response
      return res.status(HttpStatus.OK).json({ received: true });
    } catch (error: any) {
      console.error('❌ RevenueCat webhook error:', error.message);
      // Return 200 to prevent RevenueCat from retrying
      return res.status(HttpStatus.OK).json({
        received: false,
        error: error.message,
      });
    }
  }
}
