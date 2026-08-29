import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { LoggerModule, type Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { stdSerializers } from 'pino';

/**
 * The logging convention, in one file.
 *
 * Every request logs one JSON line — method, path, status, how long it took —
 * under a requestId that arrives on `X-Request-Id` so a log line, the response
 * that produced it, and the 5xx the exception filter logged for the same
 * request all join up. Credentials never reach the log: `authorization`,
 * `x-api-key` and `cookie` are redacted here rather than trusted to every
 * future log call to remember.
 *
 * Requests a machine makes on its own schedule are ignored: a probe and a
 * scraper poll far faster than anyone reads their lines, and they are exactly
 * the traffic whose absence from the log says nothing.
 */

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// An id a caller sent is honoured — a gateway correlating across services
// already has one — but only if it looks like an id, so a hostile header
// cannot write arbitrary strings into every log line. The response echoes it
// whether it was supplied or minted here.
export function requestCorrelation(request: IncomingMessage, response: ServerResponse, next: () => void) {
  const incoming = request.headers[REQUEST_ID_HEADER];
  const id = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();

  (request as IncomingMessage & { id: string }).id = id;
  response.setHeader('X-Request-Id', id);
  next();
}

// The exception filter hands an Error over under `err`; without the serializer
// its stack would be a nested object nobody can read.
const serializers = { err: stdSerializers.err };

function ignoreMachineTraffic(request: IncomingMessage): boolean {
  const url = request.url ?? '';
  return url.startsWith('/api/metrics') || url.startsWith('/api/health');
}

export const loggingModule = () =>
  LoggerModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (configService: ConfigService): Params => ({
      pinoHttp: {
        level: configService.get<string>('logLevel') ?? 'info',
        genReqId: (request: IncomingMessage) =>
          (request as IncomingMessage & { id?: string }).id ?? randomUUID(),
        autoLogging: { ignore: ignoreMachineTraffic },
        redact: {
          paths: ['req.headers.authorization', 'req.headers["x-api-key"]', 'req.headers.cookie'],
          censor: '[REDACTED]',
        },
        serializers,
      },
    }),
  });
