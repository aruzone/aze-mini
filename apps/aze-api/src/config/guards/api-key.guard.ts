import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { API_KEY_HEADER } from '../security';
import { AuditService } from '../../audit/audit.service';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers[API_KEY_HEADER];
    const configured = this.configService.get<string>('apiKey');

    if (!configured || apiKey !== configured) {
      await this.audit.appendBestEffort({
        event: 'authz.refused',
        actorUserId: null,
        subjectType: 'HttpRequest',
        subjectId: `${request.method ?? 'UNKNOWN'} ${
          request.originalUrl?.split('?')[0] ?? 'unknown'
        }`,
        details: { reason: 'invalid_api_key' },
      });
      throw new ForbiddenException('Invalid API key');
    }
    return true;
  }
}
