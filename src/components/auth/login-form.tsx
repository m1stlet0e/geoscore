"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { loginSchema } from "@/lib/validation/auth";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setError("");
    const parsed = loginSchema.safeParse({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "请检查填写内容");
      return;
    }
    setPending(true);
    const result = await signIn.email({ ...parsed.data, callbackURL: "/dashboard" });
    setPending(false);
    if (result.error) {
      setError("邮箱或密码不正确");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form action={submit} className="auth-form">
      <label>邮箱<input name="email" type="email" autoComplete="email" placeholder="name@example.com" /></label>
      <label>密码<input name="password" type="password" autoComplete="current-password" placeholder="输入密码" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="primary-button" disabled={pending}>{pending ? "正在登录…" : "登录"}</button>
    </form>
  );
}
