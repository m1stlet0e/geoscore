// Quick DB bootstrap: push schema + create seed user/brand
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { execSync } from 'node:child_process';

const url = 'postgresql://wangbo@localhost/geoos?schema=public';
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. push schema
  console.log('Pushing schema to Postgres...');
  execSync('npx prisma db push --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });

  console.log('Seeding demo user + brand...');
  const passwordHash = await bcrypt.hash('demo123456', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@geoos.ai' },
    update: {},
    create: {
      email: 'demo@geoos.ai',
      name: '王老板',
      passwordHash,
      plan: 'GROWTH',
    },
  });
  console.log('user:', user.email, user.id);

  const brand = await prisma.brand.upsert({
    where: { userId_name: { userId: user.id, name: 'TextIn' } },
    update: {},
    create: {
      userId: user.id,
      name: 'TextIn',
      domain: 'textin.com',
      description: '合合信息旗下 OCR 与文档智能平台',
      category: 'OCR API',
      competitors: ['Mathpix', 'Google Vision', 'AWS Textract', 'ABBYY'],
    },
  });
  console.log('brand:', brand.name, brand.id);

  // Seed a few prompts
  const samplePrompts = [
    '最好的 OCR API 有哪些',
    'OCR SaaS 推荐',
    '中文 OCR 识别工具对比',
    '文档识别平台',
    '教育行业 OCR 方案',
    'AI 批改系统',
    '发票识别 API',
    '手写体 OCR',
    'PDF 解析 API',
    'Math OCR 推荐',
  ];
  for (const text of samplePrompts) {
    await prisma.prompt.upsert({
      where: { id: `seed-${brand.id}-${text}` },
      update: {},
      create: {
        id: `seed-${brand.id}-${text}`,
        userId: user.id,
        brandId: brand.id,
        text,
        category: 'recommend',
        intent: '推荐',
        language: 'zh',
      },
    });
  }
  console.log(`seeded ${samplePrompts.length} prompts`);

  await prisma.$disconnect();
  console.log('✅ Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
