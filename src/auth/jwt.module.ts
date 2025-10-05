import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

//@ mean Give this class some extra metadata or behavior
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'defaultSecret'),
        signOptions: {
          expiresIn: configService.get<string | number>(
            'JWT_EXPIRES_IN',
            '3600s',
          ),
        },
      }), // factory produces configuration object
      inject: [ConfigService], // dependencies to be injected into the factory
    }),
  ],
  exports: [JwtModule],
})
export class AuthJwtModule {}
