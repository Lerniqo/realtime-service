# Token Authentication Consistency Fix

## Summary
Fixed the inconsistency between user-service and realtime-service token authentication mechanisms. The realtime-service now uses the same `SecretCodeService` with AES-256-CBC encryption as the user-service, replacing the JWT-based authentication.

## Problem
- **user-service** used custom `SecretCodeService` with AES-256-CBC encryption to create session codes
- **realtime-service** used JWT tokens for authentication
- This inconsistency caused authentication failures when user-service tokens were used with realtime-service

## Changes Made

### 1. Created SecretCodeService in realtime-service
**File:** `/realtime-service/src/auth/secret-code.service.ts`
- Implemented identical encryption/decryption logic as user-service
- Uses AES-256-CBC algorithm with scrypt key derivation
- Validates session codes and checks for expiration (24 hours)
- Injectable NestJS service that uses ConfigService for configuration

### 2. Updated RealtimeGateway
**File:** `/realtime-service/src/realtime/gateway/realtime.gateway.ts`
- Replaced `JwtService` dependency with `SecretCodeService`
- Updated `handleConnection` method to use `validateSessionCode()` instead of `jwtService.verify()`
- Maintains same user data structure: `{ userId, email, role }`

### 3. Updated RealtimeModule
**File:** `/realtime-service/src/realtime/realtime.module.ts`
- Removed `AuthJwtModule` import
- Added `SecretCodeService` as a provider
- Module now properly injects the service into the gateway

### 4. Updated Environment Configuration
**File:** `/realtime-service/.env.example`
- Added `SECRET_KEY` configuration (must match user-service)
- Kept `JWT_SECRET` for backwards compatibility (marked as legacy)
- Added documentation about the SECRET_KEY requirement

### 5. Updated Tests
**File:** `/realtime-service/src/realtime/gateway/realtime.gateway.spec.ts`
- Replaced `JwtService` mocks with `SecretCodeService` mocks
- Updated test cases to use `validateSessionCode()` instead of `verify()`
- All tests now properly validate the new authentication flow

## Migration Notes

### Environment Variables Required
Ensure the following environment variable is set in your realtime-service:

```bash
SECRET_KEY=your-super-secret-key-change-this-in-production
```

**IMPORTANT:** This `SECRET_KEY` **must match** the one used in user-service for proper token decryption.

### Token Format
Tokens are now encrypted session codes (base64 encoded) instead of JWT tokens:
- Format: Base64-encoded string containing IV and encrypted data
- Contains: `{ userId, email, role, timestamp }`
- Expiration: 24 hours from creation

### Client-Side Changes
No changes needed for WebSocket clients. They continue to send tokens in the same way:
- Via `handshake.auth.token`
- Or via `Authorization: Bearer <token>` header

### Backwards Compatibility
The JWT configuration has been kept in `.env.example` for reference but is no longer actively used by the authentication flow. You can keep or remove the JWT-related environment variables as needed.

## Testing
All existing tests have been updated and pass successfully. The authentication flow now properly validates session codes from the user-service.

## Benefits
1. **Consistency:** Both services now use the same authentication mechanism
2. **Security:** AES-256-CBC encryption with proper key derivation
3. **Expiration:** Built-in 24-hour session expiration
4. **Compatibility:** Full compatibility with user-service generated tokens
