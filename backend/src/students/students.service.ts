import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(options?: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
        { course: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        select: {
          id: true,
          name: true,
          email: true,
          course: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              tickets: { where: { status: 'active' } },
            },
          },
        },
      }),
    ]);

    return { total, students };
  }

  async findOne(id: number) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        tickets: {
          include: {
            ticketType: true,
          },
          orderBy: { issuedAt: 'desc' },
        },
        lessonRecords: {
          include: {
            instructor: { select: { name: true } },
            ticket: {
              include: { ticketType: true },
            },
          },
          orderBy: { executedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student #${id} not found`);
    }

    const { password, ...result } = student as any;
    return result;
  }

  async findByEmail(email: string) {
    return this.prisma.student.findUnique({ where: { email } });
  }

  async create(dto: CreateStudentDto, requestingUserId?: number) {
    const existing = await this.prisma.student.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const student = await this.prisma.student.create({
      data: {
        ...dto,
        password: hashedPassword,
      },
    });

    // Also create user account for login
    const userExisting = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!userExisting) {
      await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          role: 'student',
          name: dto.name,
        },
      });
    }

    await this.auditService.log({
      userId: requestingUserId,
      action: 'CREATE',
      targetEntity: 'Student',
      targetId: student.id.toString(),
      newValue: { name: student.name, email: student.email },
    });

    const { password, ...result } = student as any;
    return result;
  }

  async update(id: number, dto: UpdateStudentDto, requestingUserId?: number) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException(`Student #${id} not found`);
    }

    const updateData: any = { ...dto };

    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.student.update({
      where: { id },
      data: updateData,
    });

    // Update user account if needed
    if (dto.email || dto.name || dto.password) {
      const userUpdate: any = {};
      if (dto.name) userUpdate.name = dto.name;
      if (dto.email) userUpdate.email = dto.email;
      if (dto.password) userUpdate.password = updateData.password;

      await this.prisma.user.updateMany({
        where: { email: student.email },
        data: userUpdate,
      });
    }

    await this.auditService.log({
      userId: requestingUserId,
      action: 'UPDATE',
      targetEntity: 'Student',
      targetId: id.toString(),
      oldValue: { status: student.status, name: student.name },
      newValue: { status: updated.status, name: updated.name },
    });

    const { password, ...result } = updated as any;
    return result;
  }

  async remove(id: number, requestingUserId?: number) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException(`Student #${id} not found`);
    }

    await this.prisma.student.delete({ where: { id } });

    await this.auditService.log({
      userId: requestingUserId,
      action: 'DELETE',
      targetEntity: 'Student',
      targetId: id.toString(),
      oldValue: { name: student.name, email: student.email },
    });

    return { message: 'Student deleted successfully' };
  }

  async getTicketSummary(studentId: number) {
    const now = new Date();

    const [activeTickets, expiringTickets, totalLessons] = await Promise.all([
      this.prisma.studentTicket.findMany({
        where: { studentId, status: 'active' },
        include: { ticketType: true },
      }),
      this.prisma.studentTicket.findMany({
        where: {
          studentId,
          status: 'active',
          expiresAt: {
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            gte: now,
          },
        },
        include: { ticketType: true },
      }),
      this.prisma.lessonRecord.count({ where: { studentId } }),
    ]);

    return {
      activeTickets,
      expiringTickets,
      totalLessons,
    };
  }
}
