/**
 * IRoomStore abstraction allows swapping in-memory implementation with Redis later.
 * KEEP METHODS MINIMAL & SYNCHRONOUS for in-memory; future async for Redis is acceptable
 * (RoomsService can treat both transparently if we return plain Sets/arrays.)
 */
export interface IRoomStore {
  addSocketToRoom(socketId: string, roomName: string): void;
  removeSocketFromRoom(socketId: string, roomName: string): void;
  removeSocket(socketId: string): void; // remove from all rooms
  getRoomsForSocket(socketId: string): Set<string>;
  getSocketsInRoom(roomName: string): Set<string>;
  isSocketInRoom(socketId: string, roomName: string): boolean;
}

/**
 * InMemoryRoomStore
 *  - NOT FOR MULTI-INSTANCE PRODUCTION (state lost on restart / not shared)
 *  - O(1) lookups using dual maps for forward and reverse membership
 */
export class InMemoryRoomStore implements IRoomStore {
  private socketToRooms = new Map<string, Set<string>>();
  private roomToSockets = new Map<string, Set<string>>();

  addSocketToRoom(socketId: string, roomName: string): void {
    const rooms = this.socketToRooms.get(socketId) || new Set<string>();
    rooms.add(roomName);
    this.socketToRooms.set(socketId, rooms);

    const sockets = this.roomToSockets.get(roomName) || new Set<string>();
    sockets.add(socketId);
    this.roomToSockets.set(roomName, sockets);
  }

  removeSocketFromRoom(socketId: string, roomName: string): void {
    const rooms = this.socketToRooms.get(socketId);
    if (rooms) {
      rooms.delete(roomName);
      if (rooms.size === 0) this.socketToRooms.delete(socketId);
    }
    const sockets = this.roomToSockets.get(roomName);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) this.roomToSockets.delete(roomName);
    }
  }

  removeSocket(socketId: string): void {
    const rooms = this.socketToRooms.get(socketId);
    if (!rooms) return;
    for (const room of rooms) {
      const sockets = this.roomToSockets.get(room);
      if (sockets) {
        sockets.delete(socketId);
        if (sockets.size === 0) this.roomToSockets.delete(room);
      }
    }
    this.socketToRooms.delete(socketId);
  }

  getRoomsForSocket(socketId: string): Set<string> {
    return this.socketToRooms.get(socketId) || new Set();
  }

  getSocketsInRoom(roomName: string): Set<string> {
    return this.roomToSockets.get(roomName) || new Set();
  }

  isSocketInRoom(socketId: string, roomName: string): boolean {
    return this.socketToRooms.get(socketId)?.has(roomName) ?? false;
  }
}
