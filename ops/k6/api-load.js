import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:3001';

export const options = {
  scenarios: {
    smoke_health: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
    },
    burst_export_preview: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '30s', target: 0 },
      ],
      exec: 'exportScenario',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<900'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/api/health`);
  check(response, {
    'health status 200': (r) => r.status === 200,
  });
  sleep(0.2);
}

export function exportScenario() {
  const response = http.get(`${baseUrl}/api/health/metrics`);
  check(response, {
    'metrics status 200': (r) => r.status === 200,
  });
  sleep(0.3);
}
