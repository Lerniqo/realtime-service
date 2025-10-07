import { Injectable } from '@nestjs/common';

/**
 * RoomsService
 * Responsibilities (planned next phases):
 *  - Validate and manage socket membership in logical rooms (user:{id}, session:{id}, match:{id}, lobby:global)
 *  - Encapsulate naming conventions & enforce server-controlled private rooms
 *  - Provide helper emissions: emitToUser, emitToRoom (later)
 *  - Delegate raw membership tracking to an injected store (in-memory now; Redis-ready design)
 *
 * Not implemented yet:
 *  - Actual join/leave methods (next phase)
 *  - Server reference setter/injection for emission helpers
 *  - Authorization checks for domain-specific rooms
 */
@Injectable()
export class RoomsService {
  // Store & server references will be added in Phase 2/3
}
