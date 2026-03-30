import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RewardsService } from './rewards.service';
import { MonthlyCloseDto } from './dto/create-reward-setting.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('preview')
  @Roles('admin')
  @ApiOperation({ summary: 'Preview rewards for a month (not saved)' })
  @ApiQuery({ name: 'yearMonth', required: true, example: '2024-01' })
  @ApiQuery({ name: 'instructorId', required: false })
  preview(
    @Query('yearMonth') yearMonth: string,
    @Query('instructorId') instructorId?: string,
  ) {
    return this.rewardsService.calculateRewardsPreview(
      yearMonth,
      instructorId ? parseInt(instructorId) : undefined,
    );
  }

  @Post('close')
  @Roles('admin')
  @ApiOperation({ summary: 'Monthly close - confirm and lock records' })
  close(@Body() dto: MonthlyCloseDto, @CurrentUser() user: any) {
    return this.rewardsService.monthlyClose(dto.yearMonth, user?.id);
  }

  @Get('results')
  @Roles('admin')
  @ApiOperation({ summary: 'Get confirmed reward results' })
  @ApiQuery({ name: 'yearMonth', required: false })
  @ApiQuery({ name: 'instructorId', required: false })
  getResults(
    @Query('yearMonth') yearMonth?: string,
    @Query('instructorId') instructorId?: string,
  ) {
    return this.rewardsService.getRewardResults(
      yearMonth,
      instructorId ? parseInt(instructorId) : undefined,
    );
  }

  @Get('instructor/:id')
  @Roles('admin', 'instructor')
  @ApiOperation({ summary: 'Get rewards for specific instructor' })
  getInstructorRewards(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    // Instructors can only see their own rewards
    if (user.role === 'instructor' && user.id !== id) {
      return { confirmed: [], currentMonthPreview: null };
    }
    return this.rewardsService.getInstructorRewards(id);
  }
}
