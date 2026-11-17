import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Ім'я повинно містити щонайменше 2 символи")
    .max(60, "Ім'я занадто довге"),
  email: z.string().email('Введіть коректну Email-адресу'),
  password: z
    .string()
    .min(6, 'Пароль повинен містити щонайменше 6 символів'),
});

export const loginSchema = z.object({
  email: z.string().email('Введіть коректну Email-адресу'),
  password: z.string().min(1, 'Введіть пароль'),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, 'Відсутній Google idToken'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type GoogleLoginDto = z.infer<typeof googleLoginSchema>;

export interface AuthResponseDto {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    createdAt: Date;
  };
}
