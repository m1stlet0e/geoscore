"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { registerSchema } from "@/lib/validation/auth";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setError("");
    const input = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "请检查填写内容");
      return;
    }
    setPending(true);
    const result = await signUp.email({ ...parsed.data, callbackURL: "/dashboard" });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "注册失败，请稍后重试");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form action={submit} className="auth-form">
      <label>称呼<input name="name" autoComplete="name" placeholder="你的称呼" /></label>
      <label>邮箱<input name="email" type="email" autoComplete="email" placeholder="name@example.com" /></label>
      <label>密码<input name="password" type="password" autoComplete="new-password" placeholder="至少 8 位" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="primary-button" disabled={pending}>{pending ? "正在创建…" : "免费注册"}</button>
      <p className="form-legal">注册即表示你同意《服务协议》和《隐私政策》</p>
    </form>
  );
}
