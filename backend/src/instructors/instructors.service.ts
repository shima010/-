import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto, CreateRewardSettingDto } from './dto/update-instructor.dto';

@Injectable()
export class InstructorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(options?: { search?: string; limit?: number; offset?: number }) {
    const where: any = {};

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [total, instructors] = await Promise.all([
      this.prisma.instructor.count({ where }),
      this.prisma.instructor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        select: {
          id: true,
          name: true,
          email: true,
          rewardType: true,
          employmentType: true,
          createdAt: true,
          _count: {
            select: { lessonRecords: true },
          },
        },
      }),
    ]);

    return { total, instructors };
  }

  async findOne(id: number) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { id },
      include: {
        rewardSettings: {
          orderBy: { effectiveDate: 'desc' },
        },
        _count: {
          select: { lessonRecords: true },
        },
      },
    });

    if (!instructor) {
      throw new NotFoundException(`Instructor #${id} not found`);
    }

    const { password, ...result } = instructor as any;
    return result;
  }

  async findByEmail(email: string) {
    return this.prisma.instructor.findUnique({ where: { email } });
  }

  async create(dto: CreateInstructorDto, requestingUserId?: number) {
    const existing = await this.prisma.instructor.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const instructor = await this.prisma.instructor.create({
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
          role: 'instructor',
          name: dto.name,
        },
      });
    }

    await this.auditService.log({
      userId: requestingUserId,
      action: 'CREATE',
      targetEntity: 'Instructor',
      targetId: instructor.id.toString(),
      newValue: { name: instructor.name, email: instructor.email },
    });

    const { password, ...result } = instructor as any;
    return result;
  }

  async update(id: number, dto: UpdateInstructorDto, requestingUserId?: number) {
    const instructor = await this.prisma.instructor.findUnique({ where: { id } });
    if (!instructor) {
      throw new NotFoundException(`Instructor #${id} not found`);
    }

    const updateData: any = { ...dto };

    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.instructor.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.log({
      userId: requestingUserId,
      action: 'UPDATE',
      targetEntity: 'Instructor',
      targetId: id.toString(),
      oldValue: { name: instructor.name },
      newValue: { name: updated.name },
    });

    const { password, ...result } = updated as any;
    return result;
  }

  async remove(id: number, requestingUserId?: number) {
    const instructor = await this.prisma.instructor.findUnique({ where: { id } });
    if (!instructor) {
      throw new NotFoundException(`Instructor #${id} not found`);
    }

    await this.prisma.instructor.delete({ where: { id } });

    await this.auditService.log({
      userId: requestingUserId,
      action: 'DELETE',
      targetEntity: 'Instructor',
      targetId: id.toString(),
      oldValue: { name: instructor.name, email: instructor.email },
    });

    return { message: 'Instructor deleted successfully' };
  }

  async createRewardSetting(
    instructorId: number,
    dto: CreateRewardSettingDto,
    requestingUserId?: number,
  ) {
    const instructor = await this.prisma.instructor.findUnique({ where: { id: instructorId } });
    if (!instructor) {
      throw new NotFoundException(`Instructor #${instructorId} not found`);
    }

    const setting = await this.prisma.rewardSetting.create({
      data: {
        instructorId,
        effectiveDate: new Date(dto.effectiveDate),
        fixedRate: dto.fixedRate,
        percentageRate: dto.percentageRate,
        groupLessonRate: dto.groupLessonRate,
      },
    });

    await this.auditService.log({
      userId: requestingUserId,
      action: 'CREATE_REWARD_SETTING',
      targetEntity: 'RewardSetting',
      targetId: setting.id.toString(),
      newValue: dto,
    });

    return setting;
  }

  async getStudentsByInstructor(instructorId: number) {
    const lessons = await this.prisma.lessonRecord.findMany({
      where: { instructorId },
      select: { studentId: true },
      distinct: ['studentId'],
    });

    const studentIds = lessons.map((l) => l.studentId);

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        name: true,
        email: true,
        course: true,
        status: true,
      },
    });

    return students;
  }
}
