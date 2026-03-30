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
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles('admin', 'instructor')
  @ApiOperation({ summary: 'Get all students' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.studentsService.findAll({
      search,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':id')
  @Roles('admin', 'instructor', 'student')
  @ApiOperation({ summary: 'Get student by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.findOne(id);
  }

  @Get(':id/ticket-summary')
  @Roles('admin', 'instructor', 'student')
  @ApiOperation({ summary: 'Get student ticket summary' })
  getTicketSummary(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.getTicketSummary(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create new student' })
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: any) {
    return this.studentsService.create(dto, user?.id);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update student' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: any,
  ) {
    return this.studentsService.update(id, dto, user?.id);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete student' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.studentsService.remove(id, user?.id);
  }
}
