import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return new NextResponse("Unauthorized", { status: 401 })

    const userRecord = await prisma.user.findUnique({ where: { clerkUserId: userId } })
    if (!userRecord) return new NextResponse("User not found", { status: 404 })

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // 1. Net Worth (Total of all accounts)
    const accounts = await prisma.account.findMany({ where: { userId: userRecord.id } })
    const netWorth = accounts.reduce((acc, account) => acc + account.currentBalance, 0)
    const totalCreditLimit = accounts.reduce((acc, account) => acc + (account.creditLimit || 0), 0)

    // 2. Monthly Spend (Expenses this month)
    const monthlySpendAggr = await prisma.transaction.aggregate({
      where: {
        userId: userRecord.id,
        type: 'EXPENSE',
        date: { gte: startOfMonth }
      },
      _sum: { amount: true }
    })
    const monthlySpend = monthlySpendAggr._sum.amount || 0

    // 3. Today's Spend
    const todaySpendAggr = await prisma.transaction.aggregate({
      where: {
        userId: userRecord.id,
        type: 'EXPENSE',
        date: { gte: startOfToday }
      },
      _sum: { amount: true }
    })
    const todaySpend = todaySpendAggr._sum.amount || 0

    // 4. Category Breakdown for current month
    const categoryBreakdown = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId: userRecord.id,
        type: 'EXPENSE',
        date: { gte: startOfMonth },
        categoryId: { not: null }
      },
      _sum: { amount: true }
    })

    // Fetch category names for the breakdown
    const categoryIds = categoryBreakdown.map(c => c.categoryId!)
    const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } })
    const breakdownWithNames = categoryBreakdown.map(cb => ({
      categoryName: categories.find(c => c.id === cb.categoryId)?.name || 'Unknown',
      amount: cb._sum.amount || 0,
      color: categories.find(c => c.id === cb.categoryId)?.color || '#ccc'
    })).sort((a, b) => b.amount - a.amount)

    // 5. Last 6 Months Cash Flow (Income vs Expense)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const recentTxs = await prisma.transaction.findMany({
      where: {
        userId: userRecord.id,
        date: { gte: sixMonthsAgo },
        type: { in: ['INCOME', 'EXPENSE'] }
      },
      select: { amount: true, type: true, date: true }
    })

    const monthlyData: Record<string, { income: number, expense: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStr = d.toLocaleString('default', { month: 'short' })
      monthlyData[monthStr] = { income: 0, expense: 0 }
    }

    recentTxs.forEach(tx => {
      const mStr = tx.date.toLocaleString('default', { month: 'short' })
      if (monthlyData[mStr]) {
        if (tx.type === 'INCOME') monthlyData[mStr].income += tx.amount
        if (tx.type === 'EXPENSE') monthlyData[mStr].expense += tx.amount
      }
    })

    const cashFlow = Object.keys(monthlyData).map(month => ({
      month,
      income: monthlyData[month].income,
      expense: monthlyData[month].expense
    }))

    return NextResponse.json({
      netWorth,
      totalCreditLimit,
      monthlySpend,
      todaySpend,
      categoryBreakdown: breakdownWithNames,
      cashFlow
    })
  } catch (error) {
    console.error("[ANALYTICS_GET]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
