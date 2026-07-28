import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { accountSchema } from '@/lib/validations'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return new NextResponse("Unauthorized", { status: 401 })

    const accounts = await prisma.account.findMany({
      where: { user: { clerkUserId: userId } },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(accounts)
  } catch (error) {
    console.error("[ACCOUNTS_GET]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return new NextResponse("Unauthorized", { status: 401 })

    // Ensure the user exists in our DB (simplified sync)
    let userRecord = await prisma.user.findUnique({ where: { clerkUserId: userId } })
    if (!userRecord) {
      userRecord = await prisma.user.create({ data: { clerkUserId: userId, email: `${userId}@placeholder.com` } })
    }

    const body = await req.json()
    const parsed = accountSchema.parse(body)

    const account = await prisma.account.create({
      data: {
        ...parsed,
        userId: userRecord.id,
        currentBalance: parsed.openingBalance
      }
    })

    return NextResponse.json(account)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify(error.flatten()), { status: 400 })
    }
    console.error("[ACCOUNTS_POST]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
