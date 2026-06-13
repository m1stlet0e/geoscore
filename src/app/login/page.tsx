import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import LoginPageClient from './LoginPageClient';

export const metadata = {
  title: '登录 · GeoScore',
  description: '登录 GeoScore，继续你的 AI 可见性监控。',
};

type SP = { redirect?: string; error?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return <LoginPageClient />;
}
