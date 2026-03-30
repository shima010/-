import { IsNumber, IsDateString, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum LessonType {
  individual = 'individual',
  group = 'group',
}

export class ConsumeTicketDto {
  @ApiProperty()
  @IsNumber()
  studentId: number;

  @ApiProperty()
  @IsNumber()
  ticketId: number;

  @ApiPropertyOptional({ description: 'Instructor ID (admin only, defaults to current user)' })
  @IsNumber()
  @IsOptional()
  instructorId?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  executedAt?: string;

  @ApiPropertyOptional({ enum: LessonType, default: LessonType.individual })
  @IsEnum(LessonType)
  @IsOptional()
  lessonType?: LessonType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateLessonDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  executedAt?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
