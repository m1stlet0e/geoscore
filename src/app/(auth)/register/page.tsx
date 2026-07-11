import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return <AuthShell title="创建你的品牌雷达" description="注册后免费获得 30 次 AI 回答检测额度。" alternate={{ text: "已有账号？", label: "直接登录", href: "/login" }}><RegisterForm /></AuthShell>;
}
