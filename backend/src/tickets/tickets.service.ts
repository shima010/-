import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/create-ticket-type.dto';
import { IssueTicketDto } from './dto/issue-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // TicketType CRUD
  async findAllTicketTypes() {
    return this.prisma.ticketType.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { studentTickets: true },
        },
      },
    });
  }

  async findOneTicketType(id: number) {
    const type = await this.prisma.ticketType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException(`TicketType #${id} not found`);
    return type;
  }

  async createTicketType(dto: CreateTicketTypeDto, requestingUserId?: number) {
    const type = await this.prisma.ticketType.create({
      data: dto,
    });

    await this.auditService.log({
      userId: requestingUserId,
      action: 'CREATE',
      targetEntity: 'TicketType',
      targetId: type.id.toString(),
      newValue: dto,
    });

    return type;
  }

  async updateTicketType(id: number, dto: UpdateTicketTypeDto, requestingUserId?: number) {
    const type = await this.prisma.ticketType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException(`TicketType #${id} not found`);

    const updated = await this.prisma.ticketType.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      userId: requestingUserId,
      action: 'UPDATE',
      targetEntity: 'TicketType',
      targetId: id.toString(),
      oldValue: type,
      newValue: dto,
    });

    return updated;
  }

  async deleteTicketType(id: number, requestingUserId?: number) {
    const type = await this.prisma.ticketType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException(`TicketType #${id} not found`);

    await this.prisma.ticketType.delete({ where: { id } });

    await this.auditService.log({
      userId: requestingUserId,
      action: 'DELETE',
      targetEntity: 'TicketType',
      targetId: id.toString(),
      oldValue: type,
    });

    return { message: 'Ticket type deleted' };
  }

  // Issue tickets
  async issueTickets(dto: IssueTicketDto, requestingUserId?: number) {
    const ticketType = await this.prisma.ticketType.findUnique({
      where: { id: dto.ticketTypeId },
    });

    if (!ticketType) {
      throw new NotFoundException(`TicketType #${dto.ticketTypeId} not found`);
    }

    const issuedAt = dto.issuedAt ? new Date(dto.issuedAt) : new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setDate(expiresAt.getDate() + ticketType.validityDays);

    const tickets = await Promise.all(
      dto.studentIds.map(async (studentId) => {
        const student = await this.prisma.student.findUnique({ where: { id: studentId } });
        if (!student) throw new NotFoundException(`Student #${studentId} not found`);

        const ticket = await this.prisma.studentTicket.create({
          data: {
            studentId,
            ticketTypeId: dto.ticketTypeId,
            issuedAt,
            expiresAt,
            initialCount: ticketType.grantCount,
            remainingCount: ticketType.grantCount,
            status: 'active',
          },
          include: {
            student: { select: { name: true } },
            ticketType: true,
          },
        });

        await this.auditService.log({
          userId: requestingUserId,
          action: 'ISSUE_TICKET',
          targetEntity: 'StudentTicket',
          targetId: ticket.id.toString(),
          newValue: {
            studentId,
            ticketTypeId: dto.ticketTypeId,
            grantCount: ticketType.grantCount,
          },
        });

        return ticket;
      }),
    );

    return tickets;
  }

  // Student ticket queries
  async getStudentTickets(studentId: number, status?: string) {
    const where: any = { studentId };
    if (status) where.status = status;

    return this.prisma.studentTicket.findMany({
      where,
      include: { ticketType: true },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getActiveTickets(studentId: number) {
    const now = new Date();
    return this.prisma.studentTicket.findMany({
      where: {
        studentId,
        status: 'active',
        expiresAt: { gte: now },
        remainingCount: { gt: 0 },
      },
      include: { ticketType: true },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async getExpiringTickets(daysAhead = 7) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return this.prisma.studentTicket.findMany({
      where: {
        status: 'active',
        expiresAt: {
          gte: now,
          lte: cutoff,
        },
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        ticketType: true,
      },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async voidTicket(ticketId: number, requestingUserId?: number) {
    const ticket = await this.prisma.studentTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException(`Ticket #${ticketId} not found`);

    const updated = await this.prisma.studentTicket.update({
      where: { id: ticketId },
      data: { status: 'void' },
    });

    await this.auditService.log({
      userId: requestingUserId,
      action: 'VOID_TICKET',
      targetEntity: 'StudentTicket',
      targetId: ticketId.toString(),
      oldValue: { status: ticket.status },
      newValue: { status: 'void' },
    });

    return updated;
  }
}
