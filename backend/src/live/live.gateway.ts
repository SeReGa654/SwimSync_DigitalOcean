import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Namespace, Server, Socket } from 'socket.io';
import { appEnv } from '../config/env';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

@WebSocketGateway({
  cors: {
    origin: appEnv.frontendOrigins,
    credentials: true,
  },
  namespace: '/live',
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private readonly logger = new Logger(LiveGateway.name);
  private pubClient?: RedisClientType;
  private subClient?: RedisClientType;
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @WebSocketServer()
  server!: Server;

  async afterInit(server: Server | Namespace) {
    if (!appEnv.redisUrl) return;
    try {
      this.pubClient = createClient({ url: appEnv.redisUrl });
      this.subClient = this.pubClient.duplicate();
      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
      const ioServer = server instanceof Namespace ? server.server : server;
      ioServer.adapter(createAdapter(this.pubClient, this.subClient));
      this.logger.log('Redis adapter enabled for live gateway');
    } catch (error: unknown) {
      this.logger.error(
        `Failed to initialize Redis adapter: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-competition')
  handleJoinCompetition(client: Socket, competitionId: number) {
    client.join(`competition:${competitionId}`);
    this.logger.log(`Client ${client.id} joined competition:${competitionId}`);
  }

  @SubscribeMessage('leave-competition')
  handleLeaveCompetition(client: Socket, competitionId: number) {
    client.leave(`competition:${competitionId}`);
  }

  async notifyResultsUpdated(competitionId: number) {
    const enabled = await this.featureFlagsService.isEnabled('ff.live.scoreboard.ws');
    if (!enabled) return;
    this.server.to(`competition:${competitionId}`).emit('results:updated', { competitionId });
  }
}
