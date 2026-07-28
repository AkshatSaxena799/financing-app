import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Delete existing data to prevent duplicates on multiple runs
  await prisma.transaction.deleteMany()
  await prisma.account.deleteMany()
  await prisma.category.deleteMany()
  await prisma.user.deleteMany()

  // 1. Create a dummy user
  const user = await prisma.user.create({
    data: {
      clerkUserId: 'user_dummy_123',
      email: 'user@example.com',
      firstName: 'Demo',
      lastName: 'User'
    }
  })

  // 2. Create Categories
  const foodCat = await prisma.category.create({ data: { name: 'Food & Dining', type: 'EXPENSE', userId: user.id, color: '#f97316' } })
  const salaryCat = await prisma.category.create({ data: { name: 'Salary', type: 'INCOME', userId: user.id, color: '#10b981' } })
  const transportCat = await prisma.category.create({ data: { name: 'Transportation', type: 'EXPENSE', userId: user.id, color: '#3b82f6' } })

  // 3. Create Accounts
  const savingsAcc = await prisma.account.create({
    data: { name: 'Main Savings', bankName: 'HDFC Bank', type: 'SAVINGS', openingBalance: 50000, currentBalance: 51250, userId: user.id, color: '#3b82f6' }
  })
  const creditCard = await prisma.account.create({
    data: { name: 'Amazon Pay ICICI', type: 'CREDIT_CARD', creditLimit: 200000, openingBalance: 0, currentBalance: 12500, userId: user.id, color: '#f59e0b' }
  })

  // 4. Create some transactions
  await prisma.transaction.createMany({
    data: [
      { amount: 150000, date: new Date(new Date().setDate(1)), type: 'INCOME', accountId: savingsAcc.id, categoryId: salaryCat.id, merchant: 'Acme Corp', userId: user.id },
      { amount: 450, date: new Date(), type: 'EXPENSE', accountId: creditCard.id, categoryId: foodCat.id, merchant: 'Swiggy', userId: user.id },
      { amount: 1200, date: new Date(new Date().setDate(new Date().getDate() - 2)), type: 'EXPENSE', accountId: savingsAcc.id, categoryId: transportCat.id, merchant: 'Uber', userId: user.id }
    ]
  })

  console.log('Seeding complete!')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
  await pool.end()
})
