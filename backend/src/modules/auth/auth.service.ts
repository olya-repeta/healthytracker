import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/error.middleware';
import { AuthResponseDto, LoginDto, RegisterDto } from './auth.dto';
import { authRepository } from './auth.repository';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID || undefined);

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
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await authRepository.findByEmail(dto.email);
    if (!user) {
      throw new AppError('Невірний Email або пароль', 401);
    }

    if (!user.passwordHash) {
      throw new AppError(
        'Цей акаунт створено через Google. Будь ласка, увійдіть за допомогою кнопки Google',
        400
      );
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
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    };
  }

  async loginWithGoogle(idToken: string): Promise<AuthResponseDto> {
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID || undefined,
      });
      payload = ticket.getPayload();
    } catch {
      throw new AppError('Не вдалося верифікувати Google-токен', 401);
    }

    if (!payload || !payload.email || !payload.sub) {
      throw new AppError(
        'Google-токен не містить необхідних даних користувача (email, sub)',
        400
      );
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();
    const name =
      payload.name?.trim() || email.split('@')[0] || 'Користувач VitaTrack';
    const avatarUrl = payload.picture || null;

    let user = await authRepository.findByEmail(email);

    if (user) {
      if (!user.googleId || (!user.avatarUrl && avatarUrl)) {
        user = await authRepository.linkGoogleAccount(user.id, {
          googleId,
          avatarUrl: user.avatarUrl || avatarUrl,
        });
      }
    } else {
      user = await authRepository.createUser({
        name,
        email,
        passwordHash: null,
        googleId,
        avatarUrl,
      });
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
        avatarUrl: user.avatarUrl,
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
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
