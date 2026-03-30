import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LessonsService } from './lessons.service';
import { ConsumeTicketDto } from './dto/consume-ticket.dto';
import { ConsumeGroupTicketDto } from './dto/consume-group.dto';
import { UpdateLessonDto } from './dto/consume-ticket.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('lessons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  @Roles('admin', 'instructor', 'student')
  @ApiOperation({ summary: 'Get all lesson records' })
  @ApiQuery({ name: 'instructorId', required: false })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'isConfirmed', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(
    @Query('instructorId') instructorId?: string,
    @Query('studentId') studentId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('isConfirmed') isConfirmed?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @CurrentUser() user?: any,
  ) {
    // Instructors can only see their own records
    const effectiveInstructorId =
      user?.role === 'instructor' ? user.id : instructorId ? parseInt(instructorId) : undefined;

    // Students can only see their own records
    const effectiveStudentId =
      user?.role === 'student' ? user.id : studentId ? parseInt(studentId) : undefined;

    return this.lessonsService.findAll({
      instructorId: effectiveInstructorId,
      studentId: effectiveStudentId,
      dateFrom,
      dateTo,
      isConfirmed: isConfirmed !== undefined ? isConfirmed === 'true' : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':id')
  @Roles('admin', 'instructor', 'student')
  @ApiOperation({ summary: 'Get lesson record by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.findOne(id);
  }

  @Post('consume')
  @Roles('admin', 'instructor')
  @ApiOperation({ summary: 'Consume ticket for individual lesson' })
  consume(@Body() dto: ConsumeTicketDto, @CurrentUser() user: any) {
    // If instructor, use their profile ID
    const instructorId =
      user.role === 'instructor' ? user.id : dto.instructorId || user.id;
    return this.lessonsService.consumeTicket(dto, instructorId, user?.id);
  }

  @Post('consume-group')
  @Roles('admin', 'instructor')
  @ApiOperation({ summary: 'Consume tickets for group lesson' })
  consumeGroup(@Body() dto: ConsumeGroupTicketDto, @CurrentUser() user: any) {
    const instructorId =
      user.role === 'instructor' ? user.id : dto.instructorId || user.id;
    return this.lessonsService.consumeGroupTicket(dto, instructorId, user?.id);
  }

  @Put(':id')
  @Roles('admin', 'instructor')
  @ApiOperation({ summary: 'Update lesson record' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() user: any,
  ) {
    return this.lessonsService.update(id, dto, { id: user.id, role: user.role });
  }

  @Delete(':id')
  @Roles('admin', 'instructor')
  @ApiOperation({ summary: 'Delete lesson record' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.lessonsService.remove(id, { id: user.id, role: user.role });
  }
}
