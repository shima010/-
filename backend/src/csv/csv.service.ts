import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CsvService {
  constructor(private readonly prisma: PrismaService) {}

  private escapeCsvField(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private toCsvRow(fields: any[]): string {
    return fields.map(this.escapeCsvField).join(',');
  }

  private formatDate(date: Date | null | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ja-JP');
  }

  // Report 1: Monthly lesson results
  async generateMonthlyLessons(yearMonth: string): Promise<string> {
    const [year, month] = yearMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const lessons = await this.prisma.lessonRecord.findMany({
      where: {
        executedAt: { gte: start, lte: end },
      },
      include: {
        instructor: { select: { name: true } },
        student: { select: { name: true } },
        ticket: { include: { ticketType: true } },
      },
      orderBy: { executedAt: 'asc' },
    });

    const headers = [
      'Lesson ID',
      'Date',
      'Instructor',
      'Student',
      'Lesson Type',
      'Ticket Type',
      'Ticket Price',
      'Group Session ID',
      'Notes',
      'Confirmed',
    ];

    const rows = lessons.map((l) => [
      l.id,
      this.formatDate(l.executedAt),
      l.instructor.name,
      l.student.name,
      l.lessonType,
      l.ticket.ticketType.name,
      l.ticket.ticketType.price,
      l.groupSessionId || '',
      l.notes || '',
      l.isConfirmed ? 'Yes' : 'No',
    ]);

    const lines = [
      `# Monthly Lesson Results - ${yearMonth}`,
      this.toCsvRow(headers),
      ...rows.map((r) => this.toCsvRow(r)),
    ];

    return lines.join('\n');
  }

  // Report 2: Ticket issuance ledger
  async generateTicketIssuance(yearMonth?: string): Promise<string> {
    const where: any = {};
    if (yearMonth) {
      const [year, month] = yearMonth.split('-').map(Number);
      where.issuedAt = {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0, 23, 59, 59, 999),
      };
    }

    const tickets = await this.prisma.studentTicket.findMany({
      where,
      include: {
        student: { select: { name: true, email: true } },
        ticketType: true,
      },
      orderBy: { issuedAt: 'desc' },
    });

    const headers = [
      'Ticket ID',
      'Issued Date',
      'Student Name',
      'Student Email',
      'Ticket Type',
      'Category',
      'Price',
      'Grant Count',
      'Expires At',
      'Remaining Count',
      'Status',
    ];

    const rows = tickets.map((t) => [
      t.id,
      this.formatDate(t.issuedAt),
      t.student.name,
      t.student.email,
      t.ticketType.name,
      t.ticketType.category,
      t.ticketType.price,
      t.initialCount,
      this.formatDate(t.expiresAt),
      t.remainingCount,
      t.status,
    ]);

    const lines = [
      yearMonth ? `# Ticket Issuance Ledger - ${yearMonth}` : '# Ticket Issuance Ledger - All',
      this.toCsvRow(headers),
      ...rows.map((r) => this.toCsvRow(r)),
    ];

    return lines.join('\n');
  }

  // Report 3: Ticket balance list
  async generateTicketBalance(): Promise<string> {
    const tickets = await this.prisma.studentTicket.findMany({
      where: { status: 'active' },
      include: {
        student: { select: { id: true, name: true, email: true, course: true } },
        ticketType: true,
      },
      orderBy: [{ student: { name: 'asc' } }, { expiresAt: 'asc' }],
    });

    const headers = [
      'Student ID',
      'Student Name',
      'Email',
      'Course',
      'Ticket ID',
      'Ticket Type',
      'Category',
      'Issued Date',
      'Expires At',
      'Initial Count',
      'Remaining Count',
      'Used Count',
      'Days Until Expiry',
    ];

    const now = new Date();
    const rows = tickets.map((t) => {
      const daysUntilExpiry = Math.ceil(
        (new Date(t.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      return [
        t.student.id,
        t.student.name,
        t.student.email,
        t.student.course || '',
        t.id,
        t.ticketType.name,
        t.ticketType.category,
        this.formatDate(t.issuedAt),
        this.formatDate(t.expiresAt),
        t.initialCount,
        t.remainingCount,
        t.initialCount - t.remainingCount,
        daysUntilExpiry,
      ];
    });

    const lines = [
      '# Ticket Balance List',
      `# Generated: ${new Date().toLocaleDateString('ja-JP')}`,
      this.toCsvRow(headers),
      ...rows.map((r) => this.toCsvRow(r)),
    ];

    return lines.join('\n');
  }
}
