import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { ConnectionService } from './connection.service';
import { PinoLogger } from 'nestjs-pino';
import { RealtimeRoomsService } from '../rooms/rooms.service';
import { RedisService } from '../../redis/redis.service';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: JwtService;
  let roomsService: RealtimeRoomsService;
  let connectionService: ConnectionService;

  const mockSocket = {
    id: 'test-socket-id',
    handshake: {
      auth: { token: 'test-token' },
      headers: {},
    },
    data: { user: undefined } as any,
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: ConnectionService,
          useValue: {
            addConnections: jest.fn(),
            removeConnection: jest.fn(),
            getUserConnections: jest.fn().mockReturnValue([]),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            setContext: jest.fn(),
          },
        },
        {
          provide: RealtimeRoomsService,
          useValue: {
            ensureUserPrivateRoom: jest.fn().mockResolvedValue(undefined),
            joinRoom: jest.fn().mockResolvedValue(undefined),
            leaveRoom: jest.fn().mockResolvedValue(undefined),
            removeSocketFromAllRooms: jest.fn().mockResolvedValue(undefined),
            emitToRoom: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              status: 'ready',
              duplicate: jest.fn().mockReturnValue({
                status: 'ready',
                psubscribe: jest.fn(),
                subscribe: jest.fn(),
                on: jest.fn(),
                removeAllListeners: jest.fn(),
              }),
              psubscribe: jest.fn(),
              subscribe: jest.fn(),
              on: jest.fn(),
              removeAllListeners: jest.fn(),
            }),
            waitUntilReady: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    jwtService = module.get<JwtService>(JwtService);
    roomsService = module.get<RealtimeRoomsService>(RealtimeRoomsService);
    connectionService = module.get<ConnectionService>(ConnectionService);

    // Mock the server property
    gateway.server = {
      adapter: jest.fn(),
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as any;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should handle valid JWT token on connection', async () => {
    const mockPayload = {
      sub: 'user123',
      role: 'user',
      email: 'test@example.com',
    };

    jest.spyOn(jwtService, 'verify').mockReturnValue(mockPayload);

    await gateway.handleConnection(mockSocket as any);

    expect(jwtService.verify).toHaveBeenCalledWith('test-token');
    expect(mockSocket.data.user).toEqual({
      userId: 'user123',
      role: 'user',
      email: 'test@example.com',
    });
    expect(connectionService.addConnections).toHaveBeenCalledWith(mockSocket);
    expect(roomsService.ensureUserPrivateRoom).toHaveBeenCalledWith(mockSocket);
  });

  it('should reject connection without token', async () => {
    const socketWithoutToken = {
      ...mockSocket,
      handshake: {
        auth: {},
        headers: {},
      },
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(socketWithoutToken as any);

    // Wait for setImmediate to execute
    await new Promise((resolve) => setImmediate(resolve));

    expect(socketWithoutToken.disconnect).toHaveBeenCalledWith(true);
  });

  it('should reject connection with invalid token', async () => {
    jest.spyOn(jwtService, 'verify').mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await gateway.handleConnection(mockSocket as any);

    // Wait for setImmediate to execute
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
  });

  it('should handle disconnect properly', () => {
    mockSocket.data.user = { userId: 'user123' };

    gateway.handleDisconnect(mockSocket as any);

    expect(connectionService.removeConnection).toHaveBeenCalledWith(mockSocket);
    expect(roomsService.removeSocketFromAllRooms).toHaveBeenCalledWith(
      'test-socket-id',
    );
  });

  it('should join room on message', async () => {
    await gateway.onJoinRoom(mockSocket as any, 'test-room');

    expect(roomsService.joinRoom).toHaveBeenCalledWith(mockSocket, 'test-room');
  });

  it('should leave room on message', async () => {
    await gateway.onLeaveRoom(mockSocket as any, 'test-room');

    expect(roomsService.leaveRoom).toHaveBeenCalledWith(
      mockSocket,
      'test-room',
    );
  });

  it('should broadcast to room', async () => {
    const broadcastData = {
      room: 'test-room',
      event: 'test-event',
      payload: { message: 'hello' },
    };

    await gateway.onBroadcast(mockSocket as any, broadcastData);

    expect(roomsService.emitToRoom).toHaveBeenCalledWith(
      gateway.server,
      'test-room',
      'test-event',
      { message: 'hello' },
    );
  });

  it('should ignore empty room name in join', async () => {
    await gateway.onJoinRoom(mockSocket as any, '');

    expect(roomsService.joinRoom).not.toHaveBeenCalled();
  });

  it('should ignore empty room name in leave', async () => {
    await gateway.onLeaveRoom(mockSocket as any, '');

    expect(roomsService.leaveRoom).not.toHaveBeenCalled();
  });

  it('should ignore invalid broadcast data', async () => {
    await gateway.onBroadcast(mockSocket as any, {
      room: '',
      event: 'test',
      payload: null,
    });

    expect(roomsService.emitToRoom).not.toHaveBeenCalled();
  });
});
