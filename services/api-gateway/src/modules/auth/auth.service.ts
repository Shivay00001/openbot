/**
 * Auth Service — Registration, Login, Token Management
 */

import { Injectable, UnauthorizedException, ConflictException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { PrismaClient } from '@openbot/database';

@Injectable()
export class AuthService {
  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user
   */
  async register(email: string, password: string, name?: string) {
    // Check if user already exists
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with default settings
    const user = await this.prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        passwordHash,
        settings: {
          defaultModel: { provider: 'ollama', model: 'deepseek-r1-distill-qwen-1.5b-q4' },
          theme: 'dark',
          privacy: { saveConversations: true, saveMemory: true, analyticsEnabled: false },
        },
        // Auto-create billing account
        billing: {
          create: {
            plan: 'FREE',
            monthlyTokenLimit: BigInt(1_000_000),
          },
        },
      },
    });

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email, user.role);

    // Create session
    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      tokens,
    };
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email, user.role);

    // Create session
    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      tokens,
    };
  }

  /**
   * Refresh an access token
   */
  async refresh(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Generate new tokens
    const tokens = this.generateTokens(session.user.id, session.user.email, session.user.role);

    // Update session
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { tokens };
  }

  /**
   * Logout — revoke session
   */
  async logout(token: string) {
    await this.prisma.session.updateMany({
      where: { token },
      data: { isRevoked: true },
    });
  }

  /**
   * Validate a JWT payload (used by JwtStrategy)
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isActive: true, avatarUrl: true },
    });
    if (!user || !user.isActive) return null;
    return user;
  }

  // ─── Internal ───────────────────────────────────────────────

  private generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'openbot-refresh-secret',
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as any,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    };
  }
}
