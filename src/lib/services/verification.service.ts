import { prisma } from '@/lib/prisma'

export type VerificationChannel = 'sms' | 'email'
export type VerificationPurpose = 'register' | 'login' | 'reset_password' | 'verify_email'

const CODE_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5
const SEND_INTERVAL_MS = 60 * 1000

export class VerificationService {
  async canSend(
    identifier: string,
    channel: VerificationChannel,
    purpose: VerificationPurpose
  ): Promise<boolean> {
    const existing = await prisma.verificationToken.findUnique({
      where: {
        identifier_channel_purpose: { identifier, channel, purpose },
      },
      select: { createdAt: true },
    })

    if (!existing) return true
    return Date.now() - existing.createdAt.getTime() > SEND_INTERVAL_MS
  }

  async saveCode(
    identifier: string,
    channel: VerificationChannel,
    purpose: VerificationPurpose,
    code: string
  ): Promise<void> {
    const expires = new Date(Date.now() + CODE_TTL_MS)

    await prisma.verificationToken.upsert({
      where: {
        identifier_channel_purpose: { identifier, channel, purpose },
      },
      create: {
        identifier,
        channel,
        purpose,
        token: code,
        expires,
        attempts: 0,
        consumed: false,
      },
      update: {
        token: code,
        expires,
        attempts: 0,
        consumed: false,
        createdAt: new Date(),
      },
    })
  }

  async verify(
    identifier: string,
    channel: VerificationChannel,
    purpose: VerificationPurpose,
    code: string
  ): Promise<boolean> {
    const record = await prisma.verificationToken.findUnique({
      where: {
        identifier_channel_purpose: { identifier, channel, purpose },
      },
    })

    if (!record || record.consumed) return false
    if (record.expires < new Date()) return false
    if (record.attempts >= MAX_ATTEMPTS) return false

    if (record.token !== code) {
      await prisma.verificationToken.update({
        where: {
          identifier_channel_purpose: { identifier, channel, purpose },
        },
        data: { attempts: record.attempts + 1 },
      })
      return false
    }

    return true
  }

  async consume(
    identifier: string,
    channel: VerificationChannel,
    purpose: VerificationPurpose
  ): Promise<void> {
    await prisma.verificationToken.update({
      where: {
        identifier_channel_purpose: { identifier, channel, purpose },
      },
      data: { consumed: true },
    })
  }
}

export const verificationService = new VerificationService()
