import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@openbot/database';

@Injectable()
export class UsersService {
  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, avatarUrl: true, role: true,
        settings: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string; settings?: Record<string, unknown> }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: data as any,
      select: { id: true, email: true, name: true, avatarUrl: true, settings: true, updatedAt: true },
    });
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
