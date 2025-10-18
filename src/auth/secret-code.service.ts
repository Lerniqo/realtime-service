import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecretCodeService {
  private readonly SECRET_KEY: string;
  private readonly ALGORITHM = 'aes-256-cbc';
  private readonly IV_LENGTH = 16;

  constructor(private configService: ConfigService) {
    this.SECRET_KEY = this.configService.get<string>('SECRET_KEY') || 'your-super-secret-key-change-this-in-production';
  }

  /**
   * Encode user data into a secret code
   */
  encode(data: { userId: string; email: string; role: string; timestamp: number }): string {
    try {
      const jsonString = JSON.stringify(data);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const key = crypto.scryptSync(this.SECRET_KEY, 'salt', 32);
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      let encrypted = cipher.update(jsonString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV and encrypted data
      const result = iv.toString('hex') + ':' + encrypted;
      
      // Convert to base64 for easier transmission
      return Buffer.from(result).toString('base64');
    } catch (error) {
      console.error('Error encoding secret code:', error);
      throw new Error('Failed to encode secret code');
    }
  }

  /**
   * Decode a secret code back to user data
   */
  decode(secretCode: string): { userId: string; email: string; role: string; timestamp: number } {
    try {
      // Convert from base64
      const encryptedData = Buffer.from(secretCode, 'base64').toString('utf8');
      const [ivHex, encrypted] = encryptedData.split(':');
      
      if (!ivHex || !encrypted) {
        throw new Error('Invalid secret code format');
      }
      
      const iv = Buffer.from(ivHex, 'hex');
      const key = crypto.scryptSync(this.SECRET_KEY, 'salt', 32);
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const data = JSON.parse(decrypted);
      
      // Validate the decoded data
      if (!data.userId || !data.email || !data.role || !data.timestamp) {
        throw new Error('Invalid secret code data');
      }
      
      // Check if code has expired (24 hours)
      const now = Date.now();
      const codeAge = now - data.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (codeAge > maxAge) {
        throw new Error('Secret code has expired');
      }
      
      return data;
    } catch (error) {
      console.error('Error decoding secret code:', error);
      throw new Error('Invalid or expired secret code');
    }
  }

  /**
   * Generate a verification code for email verification
   */
  generateVerificationCode(): string {
    // Generate a 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate a password reset code
   */
  generatePasswordResetCode(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate a session code for authentication
   */
  generateSessionCode(userId: string, email: string, role: string): string {
    const data = {
      userId,
      email,
      role,
      timestamp: Date.now()
    };
    
    return this.encode(data);
  }

  /**
   * Validate a session code and return user data
   */
  validateSessionCode(sessionCode: string): { userId: string; email: string; role: string } {
    try {
      const data = this.decode(sessionCode);
      return {
        userId: data.userId,
        email: data.email,
        role: data.role
      };
    } catch (error) {
      throw new Error('Invalid session code');
    }
  }
}
