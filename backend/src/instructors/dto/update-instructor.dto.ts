import { IsEmail, IsString, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInstructorDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional()
  @IsEnum(['fixed', 'percentage'])
  @IsOptional()
  rewardType?: string;

  @ApiPropertyOptional()
  @IsEnum(['fulltime', 'parttime', 'contract'])
  @IsOptional()
  employmentType?: string;
}

export class CreateRewardSettingDto {
  @ApiPropertyOptional()
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  fixedRate?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  percentageRate?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  groupLessonRate?: number;
}
