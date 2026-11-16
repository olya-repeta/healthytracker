import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/error.middleware';
import { AuthResponseDto, LoginDto, RegisterDto } from './auth.dto';
import { authRepository } from './auth.repository';

export class AuthService {
  private generateToken(payload: {
    userId: string;
    email: string;
    name: string;
  }): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await authRepository.findByEmail(dto.email);
    if (existing) {
      throw new AppError('Користувач із таким Email вже зареєстрований', 409);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await authRepository.createUser({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await authRepository.findByEmail(dto.email);
    if (!user) {
      throw new AppError('Невірний Email або пароль', 401);
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      throw new AppError('Невірний Email або пароль', 401);
    }

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError('Користувача не знайдено', 404);
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
