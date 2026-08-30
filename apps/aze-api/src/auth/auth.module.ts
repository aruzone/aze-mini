import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginAttempts } from './login-attempts';
import { RefreshSessions } from './refresh-sessions';
import { EmailTokens } from './email-tokens';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../database/database.module';
import { RedisClientModule } from '../config/redis-client';
import { MailModule } from '../mail/mail.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  providers: [AuthService, LoginAttempts, RefreshSessions, EmailTokens],
  controllers: [AuthController],
  imports: [
    UsersModule,
    DatabaseModule,
    RedisClientModule,
    MailModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwtSecret'),
        // Short-lived by default (ADR-0009): the refresh session, not the
        // clock, is what keeps a User signed in.
        signOptions: {
          expiresIn: configService.get<number>('accessTokenTtlSeconds') as number,
        },
      }),
    }),
  ],
})
export class AuthModule {}
