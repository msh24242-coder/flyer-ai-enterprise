import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding development data...');

  // Demo company
  const company = await prisma.company.upsert({
    where: { slug: 'acme-marketing' },
    update: {},
    create: {
      name: 'Acme Marketing Co.',
      slug: 'acme-marketing',
      industry: 'Marketing & Advertising',
      website: 'https://acme-demo.example.com',
    },
  });

  console.log(`Company: ${company.name} (${company.id})`);

  // Demo owner — fake credentials only
  const passwordHash = await bcrypt.hash('Demo@Password1', 12);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@acme-demo.example.com' },
    update: {},
    create: {
      email: 'owner@acme-demo.example.com',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Demo',
      role: UserRole.OWNER,
      companyId: company.id,
      isActive: true,
    },
  });

  console.log(`Owner: ${owner.email} (${owner.id})`);

  // Demo admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@acme-demo.example.com' },
    update: {},
    create: {
      email: 'admin@acme-demo.example.com',
      passwordHash,
      firstName: 'Bob',
      lastName: 'Demo',
      role: UserRole.ADMIN,
      companyId: company.id,
      isActive: true,
    },
  });

  console.log(`Admin: ${admin.email} (${admin.id})`);

  // Demo member
  const member = await prisma.user.upsert({
    where: { email: 'member@acme-demo.example.com' },
    update: {},
    create: {
      email: 'member@acme-demo.example.com',
      passwordHash,
      firstName: 'Carol',
      lastName: 'Demo',
      role: UserRole.MEMBER,
      companyId: company.id,
      isActive: true,
    },
  });

  console.log(`Member: ${member.email} (${member.id})`);

  // Company knowledge — brand voice
  await prisma.companyKnowledge.upsert({
    where: {
      companyId_category_key: {
        companyId: company.id,
        category: 'brand',
        key: 'voice',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      category: 'brand',
      key: 'voice',
      value: {
        tone: 'professional yet approachable',
        personality: ['innovative', 'trustworthy', 'results-driven'],
        avoid: ['jargon', 'overly formal language', 'passive voice'],
      },
    },
  });

  // Company knowledge — target audience
  await prisma.companyKnowledge.upsert({
    where: {
      companyId_category_key: {
        companyId: company.id,
        category: 'audience',
        key: 'primary',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      category: 'audience',
      key: 'primary',
      value: {
        segment: 'SMB Marketing Managers',
        ageRange: '28-45',
        painPoints: ['limited budget', 'time constraints', 'proving ROI'],
        goals: ['increase brand awareness', 'generate leads', 'improve retention'],
        channels: ['LinkedIn', 'Email', 'Google Ads'],
      },
    },
  });

  // Company knowledge — sample product
  await prisma.companyKnowledge.upsert({
    where: {
      companyId_category_key: {
        companyId: company.id,
        category: 'products',
        key: 'flagship',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      category: 'products',
      key: 'flagship',
      value: {
        name: 'MarketingOS Pro',
        tagline: 'AI-powered marketing, simplified.',
        features: ['AI content generation', 'Campaign analytics', 'Multi-channel scheduling'],
        pricing: { starter: 49, professional: 149, enterprise: 'custom' },
        usp: 'The only AI marketing platform built for teams that move fast.',
      },
    },
  });

  // Company knowledge — messaging pillars
  await prisma.companyKnowledge.upsert({
    where: {
      companyId_category_key: {
        companyId: company.id,
        category: 'brand',
        key: 'messaging_pillars',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      category: 'brand',
      key: 'messaging_pillars',
      value: {
        pillars: [
          {
            name: 'Speed',
            message: 'Launch campaigns in minutes, not weeks.',
          },
          {
            name: 'Intelligence',
            message: 'AI that learns your brand and improves with every campaign.',
          },
          {
            name: 'Results',
            message: 'Measurable ROI from day one.',
          },
        ],
      },
    },
  });

  console.log('Company knowledge entries seeded.');
  console.log('\nSeed complete!');
  console.log('\nDemo credentials (development only):');
  console.log('  Owner:  owner@acme-demo.example.com / Demo@Password1');
  console.log('  Admin:  admin@acme-demo.example.com / Demo@Password1');
  console.log('  Member: member@acme-demo.example.com / Demo@Password1');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
