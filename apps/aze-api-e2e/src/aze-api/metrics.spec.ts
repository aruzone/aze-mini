import axios from 'axios';
import { anyStatus } from '../support/users';

// METRICS_ENABLED is on in the environment the suite runs against —
// apps/aze-api/.env.example ships it that way and CI sets it — so the endpoint
// answers here. It is opt-in: unset means off, and the unit suite covers the
// refusal the off state gives.
describe('GET /api/metrics', () => {
  it('answers in the Prometheus text format once enabled', async () => {
    const res = await axios.get('/api/metrics', anyStatus);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.data).toContain('http_request_duration_seconds');
    expect(res.data).toContain('process_cpu_user_seconds_total');
  });
});
