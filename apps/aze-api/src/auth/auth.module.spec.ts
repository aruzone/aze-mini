import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from './auth.module';
import { appConfig } from '../config/configuration';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';

@Global()
@Module({
  providers: [{ provide: AuditService, useValue: { appendBestEffort: jest.fn() } }],
  exports: [AuditService],
})
class AuditTestModule {}

// The signing secret is wired by name. A name appConfig does not expose leaves
// JwtModule with `secret: undefined`, which boots clean past the configuration
// check and only fails on the first login — the late failure this Starter is
// meant not to have.
describe('AuthModule', () => {
  const original = process.env;

  afterAll(() => {
    process.env = original;
  });

  it('signs with the secret the environment configured', async () => {
    process.env = { ...original, JWT_SECRET: 'a-real-secret' };

    const moduleRef = await Test.createTestingModule({
      imports: [
        // Global, so the controller's ConfigService and the JWT factory resolve
        // against the same loaded configuration.
        ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
        AuditTestModule,
        AuthModule,
      ],
    })
      .overrideProvider(DatabaseService)
      .useValue({})
      .compile();

    const jwt = moduleRef.get(JwtService);
    const token = jwt.sign({ sub: 'a-user' });

    expect(jwt.verify(token, { secret: 'a-real-secret' })).toMatchObject({
      sub: 'a-user',
    });
  });
});
