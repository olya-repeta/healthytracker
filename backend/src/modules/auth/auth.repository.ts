import { prisma } from '../../config/prisma';
import { User } from '@prisma/client';

export class AuthRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { googleId },
    });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: {
    name: string;
    email: string;
    passwordHash?: string | null;
    googleId?: string | null;
    avatarUrl?: string | null;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash ?? null,
        googleId: data.googleId ?? null,
        avatarUrl: data.avatarUrl ?? null,
      },
    });
  }

  async linkGoogleAccount(
    userId: string,
    data: { googleId: string; avatarUrl?: string | null }
  ): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        googleId: data.googleId,
        ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
      },
    });
  }
}

export const authRepository = new AuthRepository();
