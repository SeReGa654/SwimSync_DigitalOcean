import ws from 'k6/ws';
import { check } from 'k6';

const wsBase = (__ENV.WS_URL || 'ws://localhost:3001/live').replace(/^http/, 'ws');

export const options = {
  vus: 20,
  duration: '1m',
  thresholds: {
    checks: ['rate>0.99'],
  },
};

export default function () {
  const response = ws.connect(wsBase, {}, (socket) => {
    socket.on('open', () => {
      socket.send('40/live,');
      socket.close();
    });
  });

  check(response, {
    'ws connection upgraded': (r) => r && r.status === 101,
  });
}
