import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { transactionSchema } from '@/lib/validations'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const accountId = searchParams.get('accountId')
    
    const whereClause: any = { user: { clerkUserId: userId } }
    if (accountId) whereClause.accountId = accountId

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: { account: true, category: true, subcategory: true },
      orderBy: { date: 'desc' },
      take: limit
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error("[TRANSACTIONS_GET]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return new NextResponse("Unauthorized", { status: 401 })

    const userRecord = await prisma.user.findUnique({ where: { clerkUserId: userId } })
    if (!userRecord) return new NextResponse("User not found in DB", { status: 404 })

    const body = await req.json()
    const parsed = transactionSchema.parse(body)

    // Using an interactive transaction to update account balance and create transaction
    const transaction = await prisma.$transaction(async (tx) => {
      const newTx = await tx.transaction.create({
        data: {
          ...parsed,
          userId: userRecord.id,
        }
      })

      // Update balances
      const account = await tx.account.findUnique({ where: { id: parsed.accountId } })
      if (!account) throw new Error("Account not found")

      let balanceChange = 0
      if (parsed.type === 'EXPENSE') balanceChange = -parsed.amount
      else if (parsed.type === 'INCOME' || parsed.type === 'REFUND') balanceChange = parsed.amount
      else if (parsed.type === 'TRANSFER' && parsed.toAccountId) {
        balanceChange = -parsed.amount
        await tx.account.update({
          where: { id: parsed.toAccountId },
          data: { currentBalance: { increment: parsed.amount } }
        })
      }

      await tx.account.update({
        where: { id: parsed.accountId },
        data: { currentBalance: { increment: balanceChange } }
      })

      return newTx
    })

    return NextResponse.json(transaction)
  } catch (error) {
    if (error instanceof z.ZodError) return new NextResponse(JSON.stringify(error.errors), { status: 400 })
    console.error("[TRANSACTIONS_POST]", error)
    return new NextResponse(error instanceof Error ? error.message : "Internal Error", { status: 500 })
  }
}
