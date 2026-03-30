import { PrismaClient, Role, StudentStatus, RewardType, EmploymentType, TicketCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@musicschool.com' },
    update: {},
    create: {
      email: 'admin@musicschool.com',
      password: adminPassword,
      role: Role.admin,
      name: 'System Administrator',
    },
  });
  console.log('Created admin:', admin.email);

  // Create instructors
  const instructor1Password = await bcrypt.hash('Instructor@123', 10);
  const instructor1 = await prisma.instructor.upsert({
    where: { email: 'yamada@musicschool.com' },
    update: {},
    create: {
      email: 'yamada@musicschool.com',
      password: instructor1Password,
      name: 'Yamada Hanako',
      rewardType: RewardType.fixed,
      employmentType: EmploymentType.parttime,
    },
  });

  const instructor2 = await prisma.instructor.upsert({
    where: { email: 'tanaka@musicschool.com' },
    update: {},
    create: {
      email: 'tanaka@musicschool.com',
      password: instructor1Password,
      name: 'Tanaka Taro',
      rewardType: RewardType.percentage,
      employmentType: EmploymentType.fulltime,
    },
  });
  console.log('Created instructors:', instructor1.name, instructor2.name);

  // Create reward settings for instructors
  await prisma.rewardSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      instructorId: instructor1.id,
      effectiveDate: new Date('2024-01-01'),
      fixedRate: 3000,
      groupLessonRate: 1500,
    },
  });

  await prisma.rewardSetting.upsert({
    where: { id: 2 },
    update: {},
    create: {
      instructorId: instructor2.id,
      effectiveDate: new Date('2024-01-01'),
      percentageRate: 40,
      groupLessonRate: 1500,
    },
  });

  // Create students
  const studentPassword = await bcrypt.hash('Student@123', 10);
  const student1 = await prisma.student.upsert({
    where: { email: 'sato@example.com' },
    update: {},
    create: {
      email: 'sato@example.com',
      password: studentPassword,
      name: 'Sato Ichiro',
      course: 'Piano',
      status: StudentStatus.active,
    },
  });

  const student2 = await prisma.student.upsert({
    where: { email: 'suzuki@example.com' },
    update: {},
    create: {
      email: 'suzuki@example.com',
      password: studentPassword,
      name: 'Suzuki Yuki',
      course: 'Violin',
      status: StudentStatus.active,
    },
  });

  const student3 = await prisma.student.upsert({
    where: { email: 'kobayashi@example.com' },
    update: {},
    create: {
      email: 'kobayashi@example.com',
      password: studentPassword,
      name: 'Kobayashi Mio',
      course: 'Guitar',
      status: StudentStatus.active,
    },
  });
  console.log('Created students:', student1.name, student2.name, student3.name);

  // Create ticket types
  const ticketType1 = await prisma.ticketType.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Monthly 4 Lessons',
      price: 20000,
      grantCount: 4,
      validityDays: 30,
      category: TicketCategory.monthly,
    },
  });

  const ticketType2 = await prisma.ticketType.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Monthly 8 Lessons',
      price: 35000,
      grantCount: 8,
      validityDays: 30,
      category: TicketCategory.monthly,
    },
  });

  const ticketType3 = await prisma.ticketType.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: '10 Lesson Coupon',
      price: 45000,
      grantCount: 10,
      validityDays: 90,
      category: TicketCategory.coupon,
    },
  });
  console.log('Created ticket types:', ticketType1.name, ticketType2.name, ticketType3.name);

  // Issue tickets to students
  const now = new Date();
  const expiresAt30 = new Date(now);
  expiresAt30.setDate(expiresAt30.getDate() + 30);

  const expiresAt5 = new Date(now);
  expiresAt5.setDate(expiresAt5.getDate() + 5);

  const ticket1 = await prisma.studentTicket.create({
    data: {
      studentId: student1.id,
      ticketTypeId: ticketType1.id,
      issuedAt: now,
      expiresAt: expiresAt30,
      initialCount: 4,
      remainingCount: 3,
      status: 'active',
    },
  });

  const ticket2 = await prisma.studentTicket.create({
    data: {
      studentId: student2.id,
      ticketTypeId: ticketType2.id,
      issuedAt: now,
      expiresAt: expiresAt5,
      initialCount: 8,
      remainingCount: 2,
      status: 'active',
    },
  });

  const ticket3 = await prisma.studentTicket.create({
    data: {
      studentId: student3.id,
      ticketTypeId: ticketType3.id,
      issuedAt: now,
      expiresAt: expiresAt30,
      initialCount: 10,
      remainingCount: 10,
      status: 'active',
    },
  });
  console.log('Created student tickets');

  // Create lesson records
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.lessonRecord.create({
    data: {
      executedAt: yesterday,
      instructorId: instructor1.id,
      studentId: student1.id,
      ticketId: ticket1.id,
      lessonType: 'individual',
      notes: 'Good progress on scales',
      isConfirmed: false,
    },
  });

  await prisma.lessonRecord.create({
    data: {
      executedAt: yesterday,
      instructorId: instructor2.id,
      studentId: student2.id,
      ticketId: ticket2.id,
      lessonType: 'individual',
      notes: 'Worked on bow technique',
      isConfirmed: false,
    },
  });
  console.log('Created lesson records');

  // Create instructor user accounts (for login)
  const instrUser1 = await prisma.user.upsert({
    where: { email: 'yamada@musicschool.com' },
    update: {},
    create: {
      email: 'yamada@musicschool.com',
      password: instructor1Password,
      role: Role.instructor,
      name: 'Yamada Hanako',
    },
  });

  const instrUser2 = await prisma.user.upsert({
    where: { email: 'tanaka@musicschool.com' },
    update: {},
    create: {
      email: 'tanaka@musicschool.com',
      password: instructor1Password,
      role: Role.instructor,
      name: 'Tanaka Taro',
    },
  });

  // Create student user accounts (for login)
  await prisma.user.upsert({
    where: { email: 'sato@example.com' },
    update: {},
    create: {
      email: 'sato@example.com',
      password: studentPassword,
      role: Role.student,
      name: 'Sato Ichiro',
    },
  });

  await prisma.user.upsert({
    where: { email: 'suzuki@example.com' },
    update: {},
    create: {
      email: 'suzuki@example.com',
      password: studentPassword,
      role: Role.student,
      name: 'Suzuki Yuki',
    },
  });

  await prisma.user.upsert({
    where: { email: 'kobayashi@example.com' },
    update: {},
    create: {
      email: 'kobayashi@example.com',
      password: studentPassword,
      role: Role.student,
      name: 'Kobayashi Mio',
    },
  });

  console.log('Seeding complete!');
  console.log('\nDefault credentials:');
  console.log('  Admin: admin@musicschool.com / Admin@123456');
  console.log('  Instructor: yamada@musicschool.com / Instructor@123');
  console.log('  Student: sato@example.com / Student@123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
