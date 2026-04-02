import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: '監査ログ一覧取得' })
  @ApiQuery({ name: 'targetEntity', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async findAll(
    @Query('targetEntity') targetEntity?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.findAll({
      targetEntity: targetEntity || undefined,
      action: action || undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get('logs/csv')
  @ApiOperation({ summary: '監査ログCSVダウンロード（RFP 8）' })
  async downloadCsv(
    @Query('targetEntity') targetEntity?: string,
    @Query('action') action?: string,
    @Res() res?: Response,
  ) {
    const { logs } = await this.auditService.findAll({
      targetEntity: targetEntity || undefined,
      action: action || undefined,
      limit: 10000,
    });

    const escapeCsv = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = [
      ['ID', '日時', 'ユーザー', 'ロール', 'アクション', '対象エンティティ', '対象ID', '変更前', '変更後'],
      ...logs.map((log) => [
        log.id,
        new Date(log.createdAt).toLocaleString('ja-JP'),
        log.user?.name || '—',
        log.userRole || '—',
        log.action,
        log.targetEntity,
        log.targetId || '—',
        log.oldValue ? JSON.stringify(log.oldValue) : '—',
        log.newValue ? JSON.stringify(log.newValue) : '—',
      ]),
    ];

    const csv = '\uFEFF' + rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
    const filename = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
