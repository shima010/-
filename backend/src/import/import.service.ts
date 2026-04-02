import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface StudentCsvRow {
  name: string;
  email: string;
  course?: string;
  status?: string;
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * CSVテキストをパースして生徒を一括登録する。
   * CSV形式: name,email,course,status（1行目はヘッダー）
   * RFP 10.2: 初期データ登録 - 既存生徒約200名のCSVインポート
   */
  async importStudentsFromCsv(csvText: string, requestingUserId?: number) {
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    if (lines.length < 2) {
      throw new BadRequestException('CSVにデータ行がありません');
    }

    // Parse header
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = header.indexOf('name');
    const emailIdx = header.indexOf('email');
    const courseIdx = header.indexOf('course');
    const statusIdx = header.indexOf('status');

    if (nameIdx === -1 || emailIdx === -1) {
      throw new BadRequestException('CSVヘッダーに "name" と "email" 列が必要です');
    }

    const rows: StudentCsvRow[] = [];
    const errors: { line: number; message: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = this.parseCsvLine(line);
      const name = cols[nameIdx]?.trim();
      const email = cols[emailIdx]?.trim();

      if (!name || !email) {
        errors.push({ line: i + 1, message: `name または email が空です: "${line}"` });
        continue;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ line: i + 1, message: `メールアドレスの形式が不正です: "${email}"` });
        continue;
      }

      rows.push({
        name,
        email,
        course: courseIdx !== -1 ? cols[courseIdx]?.trim() || undefined : undefined,
        status: statusIdx !== -1 ? cols[statusIdx]?.trim() || 'active' : 'active',
      });
    }

    if (errors.length > 0 && rows.length === 0) {
      throw new BadRequestException({
        message: 'CSVの全行にエラーがあります',
        errors,
      });
    }

    const defaultPassword = await bcrypt.hash('Change@Password1', 10);

    const results = { created: 0, skipped: 0, errors };

    for (const row of rows) {
      const existingStudent = await this.prisma.student.findUnique({
        where: { email: row.email },
      });

      if (existingStudent) {
        results.skipped++;
        continue;
      }

      const validStatuses = ['active', 'suspended', 'withdrawn'];
      const status = validStatuses.includes(row.status || '') ? row.status : 'active';

      await this.prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            name: row.name,
            email: row.email,
            password: defaultPassword,
            course: row.course || null,
            status: status as any,
          },
        });

        // Create User record for auth
        const userExists = await tx.user.findUnique({ where: { email: row.email } });
        if (!userExists) {
          await tx.user.create({
            data: {
              email: row.email,
              password: defaultPassword,
              role: 'student',
              name: row.name,
            },
          });
        }

        return student;
      });

      results.created++;
    }

    await this.auditService.log({
      userId: requestingUserId,
      action: 'CSV_IMPORT_STUDENTS',
      targetEntity: 'Student',
      newValue: {
        created: results.created,
        skipped: results.skipped,
        errorCount: errors.length,
      },
    });

    return {
      message: `インポート完了: 新規登録 ${results.created}件、スキップ ${results.skipped}件`,
      ...results,
    };
  }

  /**
   * チケット残高の初期移行CSVをインポートする。
   * CSV形式: student_email,ticket_type_id,remaining_count,expires_at
   * RFP 10.2: 紙管理のチケット残数の移行
   */
  async importTicketBalances(csvText: string, requestingUserId?: number) {
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    if (lines.length < 2) {
      throw new BadRequestException('CSVにデータ行がありません');
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const emailIdx = header.indexOf('student_email');
    const typeIdIdx = header.indexOf('ticket_type_id');
    const countIdx = header.indexOf('remaining_count');
    const expiresIdx = header.indexOf('expires_at');

    if (emailIdx === -1 || typeIdIdx === -1 || countIdx === -1 || expiresIdx === -1) {
      throw new BadRequestException(
        'CSVヘッダーに student_email, ticket_type_id, remaining_count, expires_at が必要です',
      );
    }

    const results = { created: 0, errors: [] as { line: number; message: string }[] };

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = this.parseCsvLine(line);
      const email = cols[emailIdx]?.trim();
      const ticketTypeId = parseInt(cols[typeIdIdx]?.trim() || '');
      const remainingCount = parseInt(cols[countIdx]?.trim() || '');
      const expiresAt = new Date(cols[expiresIdx]?.trim() || '');

      if (!email || isNaN(ticketTypeId) || isNaN(remainingCount) || isNaN(expiresAt.getTime())) {
        results.errors.push({ line: i + 1, message: `データが不正です: "${line}"` });
        continue;
      }

      const student = await this.prisma.student.findUnique({ where: { email } });
      if (!student) {
        results.errors.push({ line: i + 1, message: `生徒が見つかりません: ${email}` });
        continue;
      }

      const ticketType = await this.prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
      if (!ticketType) {
        results.errors.push({ line: i + 1, message: `チケット種別が見つかりません: ${ticketTypeId}` });
        continue;
      }

      await this.prisma.studentTicket.create({
        data: {
          studentId: student.id,
          ticketTypeId,
          issuedAt: new Date(),
          expiresAt,
          initialCount: remainingCount,
          remainingCount,
          status: 'active',
        },
      });

      results.created++;
    }

    await this.auditService.log({
      userId: requestingUserId,
      action: 'CSV_IMPORT_TICKET_BALANCES',
      targetEntity: 'StudentTicket',
      newValue: { created: results.created, errorCount: results.errors.length },
    });

    return {
      message: `チケット残高インポート完了: ${results.created}件`,
      ...results,
    };
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}
