import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { ConnectionService } from './connection.service';
import { io, Socket } from 'socket.io-client';
import { INestApplication } from '@nestjs/common';

describe('RealtimeGateway', () => {
  let app: INestApplication;
  let gateway: RealtimeGateway;
  let jwtService: JwtService;
  let clientSocket: Socket;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        ConnectionService,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    gateway = moduleFixture.get<RealtimeGateway>(RealtimeGateway);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.listen(3001);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
  });

  it('should accept valid JWT token', (done) => {
    jest.spyOn(jwtService, 'verify').mockReturnValue({
      sub: 'user123',
      role: 'user',
      email: 'test@example.com',
    });

    clientSocket = io('http://localhost:3001', {
      auth: { token: 'valid-token' },
    });

    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    clientSocket.on('connect_error', () => {
      done.fail('Should not receive connect_error for valid token');
    });
  }, 10000);

  it('should reject invalid JWT token', (done) => {
    jest.spyOn(jwtService, 'verify').mockImplementation(() => {
      throw new Error('Invalid token');
    });

    clientSocket = io('http://localhost:3001', {
      auth: { token: 'invalid-token' },
    });

    clientSocket.on('connect', () => {
      done.fail('Should not connect with invalid token');
    });

    clientSocket.on('connect_error', (error) => {
      // Socket.IO automatically sends connect_error when connection is rejected
      expect(error).toBeDefined();
      done();
    });
  }, 10000);
});
