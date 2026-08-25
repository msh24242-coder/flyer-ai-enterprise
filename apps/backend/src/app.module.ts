import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AgentEngineModule } from './modules/agent-engine/agent-engine.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { MarketingAgentModule } from './modules/marketing-director/marketing-agent.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { ContentModule } from './modules/content/content.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    HealthModule,
    AgentEngineModule,
    AuthModule,
    CompanyModule,
    MarketingAgentModule,
    AgentsModule,
    ApprovalsModule,
    ContentModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
