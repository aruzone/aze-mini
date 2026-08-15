import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { API_KEY_HEADER } from '../security';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers[API_KEY_HEADER];
    const configured = this.configService.get<string>('apiKey');

    if (!configured || apiKey !== configured) {
      throw new ForbiddenException('Invalid API key');
    }
    return true;
  }
}
