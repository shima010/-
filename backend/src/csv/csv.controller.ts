import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CsvService } from './csv.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('csv')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('csv')
export class CsvController {
  constructor(private readonly csvService: CsvService) {}

  @Get('monthly-lessons')
  @Roles('admin')
  @ApiOperation({ summary: 'Export monthly lesson results as CSV' })
  @ApiQuery({ name: 'yearMonth', required: true, example: '2024-01' })
  async monthlyLessons(@Query('yearMonth') yearMonth: string, @Res() res: Response) {
    const csv = await this.csvService.generateMonthlyLessons(yearMonth);
    const filename = `monthly-lessons-${yearMonth}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel compatibility
  }

  @Get('ticket-issuance')
  @Roles('admin')
  @ApiOperation({ summary: 'Export ticket issuance ledger as CSV' })
  @ApiQuery({ name: 'yearMonth', required: false })
  async ticketIssuance(@Query('yearMonth') yearMonth: string | undefined, @Res() res: Response) {
    const csv = await this.csvService.generateTicketIssuance(yearMonth);
    const filename = yearMonth ? `ticket-issuance-${yearMonth}.csv` : 'ticket-issuance-all.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  }

  @Get('ticket-balance')
  @Roles('admin')
  @ApiOperation({ summary: 'Export ticket balance list as CSV' })
  async ticketBalance(@Res() res: Response) {
    const csv = await this.csvService.generateTicketBalance();
    const filename = `ticket-balance-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  }
}
