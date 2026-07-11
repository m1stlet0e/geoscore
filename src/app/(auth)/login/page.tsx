import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";

export default function LoginPage() {
  return <AuthShell title="欢迎回来" description="继续追踪你的品牌在 AI 世界里的位置。" alternate={{ text: "还没有账号？", label: "免费注册", href: "/register" }}><LoginForm /><div className="auth-divider"><span>或使用手机号</span></div><PhoneLoginForm /></AuthShell>;
}
