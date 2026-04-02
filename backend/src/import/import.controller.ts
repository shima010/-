import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ImportService } from './import.service';

@ApiTags('import')
@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('students')
  @ApiOperation({
    summary: '生徒CSVインポート',
    description: 'CSV形式: name,email,course,status（1行目ヘッダー）。初期データ移行用。',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importStudents(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('CSVファイルを添付してください');
    if (!file.originalname.endsWith('.csv') && file.mimetype !== 'text/csv') {
      throw new BadRequestException('CSVファイルのみ受け付けます');
    }

    const csvText = file.buffer.toString('utf-8');
    return this.importService.importStudentsFromCsv(csvText, user.id);
  }

  @Post('students/text')
  @ApiOperation({
    summary: '生徒CSVインポート（テキスト本文）',
    description: 'CSVをリクエストボディとして直接送信する方法（テスト用）。',
  })
  async importStudentsFromText(
    @Body('csv') csvText: string,
    @CurrentUser() user: any,
  ) {
    if (!csvText) throw new BadRequestException('csv フィールドにCSVテキストを指定してください');
    return this.importService.importStudentsFromCsv(csvText, user.id);
  }

  @Post('ticket-balances')
  @ApiOperation({
    summary: 'チケット残高CSVインポート',
    description:
      'CSV形式: student_email,ticket_type_id,remaining_count,expires_at。紙管理からの移行用。',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importTicketBalances(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('CSVファイルを添付してください');

    const csvText = file.buffer.toString('utf-8');
    return this.importService.importTicketBalances(csvText, user.id);
  }
}
