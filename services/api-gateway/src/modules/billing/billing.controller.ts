import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { BillingService } from './billing.service';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'Get billing info and quota status' })
  async getInfo(@Req() req: any) {
    const data = await this.service.getInfo(req.user.id);
    return { success: true, data };
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get usage summary for current billing period' })
  async getUsage(@Req() req: any) {
    const data = await this.service.getUsageSummary(req.user.id);
    return { success: true, data };
  }
}
