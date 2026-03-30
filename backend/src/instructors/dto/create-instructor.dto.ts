import { IsEmail, IsString, IsOptional, IsEnum, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RewardType {
  fixed = 'fixed',
  percentage = 'percentage',
}

export enum EmploymentType {
  fulltime = 'fulltime',
  parttime = 'parttime',
  contract = 'contract',
}

export class CreateInstructorDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: RewardType })
  @IsEnum(RewardType)
  @IsOptional()
  rewardType?: RewardType;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;
}
