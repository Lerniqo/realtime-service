import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { ConnectionService } from './connection.service';
import { io, Socket } from 'socket.io-client';
import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { PinoLogger } from 'nestjs-pino';

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
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
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
      timeout: 1000,
    });

    let connectReceived = false;

    clientSocket.on('connect', () => {
      connectReceived = true;
      // Wait a bit to see if disconnect happens immediately
      setTimeout(() => {
        if (clientSocket.connected) {
          done(new Error('Should not remain connected with invalid token'));
        } else {
          // Connection was terminated, which is what we expect
          done();
        }
      }, 100);
    });

    clientSocket.on('connect_error', (error) => {
      if (!connectReceived) {
        // This is the ideal case - connection was rejected before connect
        expect(error).toBeDefined();
        done();
      }
    });

    clientSocket.on('disconnect', () => {
      if (connectReceived) {
        // Connection was established then immediately terminated
        done();
      }
    });

    // Timeout if nothing happens
    setTimeout(() => {
      if (!connectReceived) {
        done(new Error('Test timeout - no connection or error event received'));
      }
    }, 2000);
  }, 10000);
});
