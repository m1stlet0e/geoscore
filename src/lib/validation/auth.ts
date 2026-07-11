import { z } from "zod";

export const phoneSchema = z
  .string()
  .regex(/^1[3-9]\d{9}$/, "请输入正确的中国大陆手机号");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "请输入至少 2 个字符的名称").max(40),
  email: z.email("请输入正确的邮箱地址"),
  password: z.string().min(8, "密码至少需要 8 位").max(128),
});

export const loginSchema = z.object({
  email: z.email("请输入正确的邮箱地址"),
  password: z.string().min(8, "密码至少需要 8 位"),
});
