import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Check admin/instructor in users table first
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
      const token = this.jwtService.sign(payload);

      await this.auditService.log({
        userId: user.id,
        userRole: user.role,
        action: 'LOGIN',
        targetEntity: 'User',
        targetId: user.id.toString(),
      });

      // For instructors, get the instructor profile ID
      let profileId = user.id;
      if (user.role === 'instructor') {
        const instructor = await this.prisma.instructor.findUnique({
          where: { email: user.email },
        });
        profileId = instructor?.id || user.id;
      } else if (user.role === 'student') {
        const student = await this.prisma.student.findUnique({
          where: { email: user.email },
        });
        profileId = student?.id || user.id;
      }

      return {
        access_token: token,
        user: {
          id: user.id,
          profileId,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }

    throw new UnauthorizedException('Invalid credentials');
  }

  async getProfile(user: any) {
    if (user.role === 'instructor') {
      const instructor = await this.prisma.instructor.findUnique({
        where: { email: user.email },
        include: {
          rewardSettings: {
            orderBy: { effectiveDate: 'desc' },
            take: 1,
          },
        },
      });
      return { ...user, profile: instructor };
    }

    if (user.role === 'student') {
      const student = await this.prisma.student.findUnique({
        where: { email: user.email },
      });
      return { ...user, profile: student };
    }

    return user;
  }

  async validateUser(id: number, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return { id: user.id, email: user.email, role: user.role, name: user.name };
  }
}
