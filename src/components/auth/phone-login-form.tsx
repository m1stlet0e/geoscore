"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { phoneSchema } from "@/lib/validation/auth";

export function PhoneLoginForm() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    setError("");
    const parsed = phoneSchema.safeParse(phoneNumber);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "手机号不正确");
      return;
    }
    setPending(true);
    const result = await authClient.phoneNumber.sendOtp({ phoneNumber: parsed.data });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "验证码发送失败");
      return;
    }
    setCodeSent(true);
  }

  async function verify(formData: FormData) {
    setError("");
    const code = String(formData.get("code") ?? "");
    if (!/^\d{6}$/.test(code)) {
      setError("请输入 6 位验证码");
      return;
    }
    setPending(true);
    const result = await authClient.phoneNumber.verify({ phoneNumber, code });
    setPending(false);
    if (result.error || !result.data?.status) {
      setError("验证码不正确或已过期");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form action={verify} className="auth-form phone-form">
      <label>手机号
        <span className="phone-input">
          <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, 11))} inputMode="tel" autoComplete="tel" placeholder="中国大陆手机号" />
          <button type="button" onClick={sendCode} disabled={pending}>{codeSent ? "重新发送" : "发送验证码"}</button>
        </span>
      </label>
      {codeSent && <label>短信验证码<input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder={process.env.NODE_ENV === "development" ? "本地验证码 888888" : "6 位验证码"} /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {codeSent && <button type="submit" className="primary-button" disabled={pending}>{pending ? "正在验证…" : "验证并登录"}</button>}
    </form>
  );
}
