import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConsumeTicketDto } from './dto/consume-ticket.dto';
import { ConsumeGroupTicketDto } from './dto/consume-group.dto';
import { UpdateLessonDto } from './dto/consume-ticket.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async consumeTicket(dto: ConsumeTicketDto, instructorId: number, requestingUserId?: number) {
    const ticket = await this.prisma.studentTicket.findUnique({
      where: { id: dto.ticketId },
      include: { ticketType: true },
    });

    if (!ticket) throw new NotFoundException(`Ticket #${dto.ticketId} not found`);
    if (ticket.studentId !== dto.studentId) {
      throw new BadRequestException('Ticket does not belong to this student');
    }
    if (ticket.status !== 'active') {
      throw new BadRequestException(`Ticket is ${ticket.status}`);
    }
    if (ticket.remainingCount <= 0) {
      throw new BadRequestException('Ticket has no remaining lessons');
    }
    if (new Date(ticket.expiresAt) < new Date()) {
      throw new BadRequestException('Ticket has expired');
    }

    const executedAt = dto.executedAt ? new Date(dto.executedAt) : new Date();

    // Use transaction for atomicity
    const [lessonRecord, updatedTicket] = await this.prisma.$transaction([
      this.prisma.lessonRecord.create({
        data: {
          executedAt,
          instructorId,
          studentId: dto.studentId,
          ticketId: dto.ticketId,
          lessonType: dto.lessonType || 'individual',
          notes: dto.notes || null,
          isConfirmed: false,
        },
        include: {
          student: { select: { name: true } },
          instructor: { select: { name: true } },
          ticket: { include: { ticketType: true } },
        },
      }),
      this.prisma.studentTicket.update({
        where: { id: dto.ticketId },
        data: {
          remainingCount: { decrement: 1 },
          status: ticket.remainingCount - 1 === 0 ? 'consumed' : 'active',
        },
      }),
    ]);

    await this.auditService.log({
      userId: requestingUserId,
      action: 'CONSUME_TICKET',
      targetEntity: 'LessonRecord',
      targetId: lessonRecord.id.toString(),
      newValue: {
        studentId: dto.studentId,
        ticketId: dto.ticketId,
        remainingCount: ticket.remainingCount - 1,
      },
    });

    return lessonRecord;
  }

  async consumeGroupTicket(
    dto: ConsumeGroupTicketDto,
    instructorId: number,
    requestingUserId?: number,
  ) {
    const groupSessionId = uuidv4();
    const executedAt = dto.executedAt ? new Date(dto.executedAt) : new Date();

    const records = await this.prisma.$transaction(async (tx) => {
      const lessonRecords = [];

      for (const s of dto.students) {
        const ticket = await tx.studentTicket.findUnique({
          where: { id: s.ticketId },
          include: { ticketType: true },
        });

        if (!ticket) throw new NotFoundException(`Ticket #${s.ticketId} not found`);
        if (ticket.studentId !== s.studentId) {
          throw new BadRequestException(`Ticket #${s.ticketId} does not belong to student #${s.studentId}`);
        }
        if (ticket.status !== 'active') {
          throw new BadRequestException(`Ticket #${s.ticketId} is ${ticket.status}`);
        }
        if (ticket.remainingCount <= 0) {
          throw new BadRequestException(`Ticket #${s.ticketId} has no remaining lessons`);
        }

        const lesson = await tx.lessonRecord.create({
          data: {
            executedAt,
            instructorId,
            studentId: s.studentId,
            ticketId: s.ticketId,
            lessonType: 'group',
            groupSessionId,
            notes: dto.notes || null,
            isConfirmed: false,
          },
          include: {
            student: { select: { name: true } },
            instructor: { select: { name: true } },
            ticket: { include: { ticketType: true } },
          },
        });

        await tx.studentTicket.update({
          where: { id: s.ticketId },
          data: {
            remainingCount: { decrement: 1 },
            status: ticket.remainingCount - 1 === 0 ? 'consumed' : 'active',
          },
        });

        lessonRecords.push(lesson);
      }

      return lessonRecords;
    });

    await this.auditService.log({
      userId: requestingUserId,
      action: 'CONSUME_GROUP_TICKET',
      targetEntity: 'LessonRecord',
      targetId: groupSessionId,
      newValue: {
        groupSessionId,
        studentCount: dto.students.length,
        instructorId,
      },
    });

    return records;
  }

  async findAll(options?: {
    instructorId?: number;
    studentId?: number;
    dateFrom?: string;
    dateTo?: string;
    isConfirmed?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (options?.instructorId) where.instructorId = options.instructorId;
    if (options?.studentId) where.studentId = options.studentId;
    if (options?.isConfirmed !== undefined) where.isConfirmed = options.isConfirmed;

    if (options?.dateFrom || options?.dateTo) {
      where.executedAt = {};
      if (options.dateFrom) where.executedAt.gte = new Date(options.dateFrom);
      if (options.dateTo) where.executedAt.lte = new Date(options.dateTo);
    }

    const [total, records] = await Promise.all([
      this.prisma.lessonRecord.count({ where }),
      this.prisma.lessonRecord.findMany({
        where,
        include: {
          instructor: { select: { id: true, name: true } },
          student: { select: { id: true, name: true } },
          ticket: { include: { ticketType: true } },
        },
        orderBy: { executedAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
    ]);

    return { total, records };
  }

  async findOne(id: number) {
    const record = await this.prisma.lessonRecord.findUnique({
      where: { id },
      include: {
        instructor: { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
        ticket: { include: { ticketType: true } },
      },
    });

    if (!record) throw new NotFoundException(`LessonRecord #${id} not found`);
    return record;
  }

  async update(
    id: number,
    dto: UpdateLessonDto,
    requestingUser: { id: number; role: string },
  ) {
    const record = await this.prisma.lessonRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`LessonRecord #${id} not found`);

    if (record.isConfirmed) {
      throw new ForbiddenException('Cannot modify confirmed lesson records');
    }

    // Instructors can only edit same-day records
    if (requestingUser.role === 'instructor') {
      const today = new Date();
      const recordDate = new Date(record.executedAt);
      if (
        today.getFullYear() !== recordDate.getFullYear() ||
        today.getMonth() !== recordDate.getMonth() ||
        today.getDate() !== recordDate.getDate()
      ) {
        throw new ForbiddenException('Instructors can only edit same-day lesson records');
      }

      if (record.instructorId !== requestingUser.id) {
        throw new ForbiddenException('You can only edit your own lesson records');
      }
    }

    const updated = await this.prisma.lessonRecord.update({
      where: { id },
      data: {
        executedAt: dto.executedAt ? new Date(dto.executedAt) : undefined,
        notes: dto.notes,
      },
      include: {
        instructor: { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
        ticket: { include: { ticketType: true } },
      },
    });

    await this.auditService.log({
      userId: requestingUser.id,
      action: 'UPDATE',
      targetEntity: 'LessonRecord',
      targetId: id.toString(),
      oldValue: { executedAt: record.executedAt, notes: record.notes },
      newValue: dto,
    });

    return updated;
  }

  async remove(id: number, requestingUser: { id: number; role: string }) {
    const record = await this.prisma.lessonRecord.findUnique({
      where: { id },
      include: { ticket: true },
    });
    if (!record) throw new NotFoundException(`LessonRecord #${id} not found`);

    if (record.isConfirmed) {
      throw new ForbiddenException('Cannot delete confirmed lesson records');
    }

    // Instructors can only delete same-day records
    if (requestingUser.role === 'instructor') {
      const today = new Date();
      const recordDate = new Date(record.executedAt);
      if (
        today.getFullYear() !== recordDate.getFullYear() ||
        today.getMonth() !== recordDate.getMonth() ||
        today.getDate() !== recordDate.getDate()
      ) {
        throw new ForbiddenException('Instructors can only delete same-day lesson records');
      }
    }

    // Restore ticket count
    await this.prisma.$transaction([
      this.prisma.lessonRecord.delete({ where: { id } }),
      this.prisma.studentTicket.update({
        where: { id: record.ticketId },
        data: {
          remainingCount: { increment: 1 },
          status: 'active',
        },
      }),
    ]);

    await this.auditService.log({
      userId: requestingUser.id,
      action: 'DELETE',
      targetEntity: 'LessonRecord',
      targetId: id.toString(),
      oldValue: { studentId: record.studentId, executedAt: record.executedAt },
    });

    return { message: 'Lesson record deleted and ticket restored' };
  }
}
