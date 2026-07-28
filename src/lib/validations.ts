import { z } from 'zod'
import { AccountType, AccountStatus, TransactionType, PaymentMethod } from '../generated/prisma/client'

export const accountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  bankName: z.string().optional(),
  type: z.nativeEnum(AccountType),
  status: z.nativeEnum(AccountStatus).default('ACTIVE'),
  openingBalance: z.number().default(0),
  color: z.string().optional(),
  icon: z.string().optional(),
  
  // Credit card specific fields
  network: z.string().optional(),
  creditLimit: z.number().optional(),
  statementDate: z.number().min(1).max(31).optional(),
  dueDate: z.number().min(1).max(31).optional(),
  interestRate: z.number().optional(),
  rewardType: z.string().optional(),
})

export const transactionSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  date: z.string().datetime(), // ISO string
  type: z.nativeEnum(TransactionType),
  
  accountId: z.string().cuid("Invalid Account ID"),
  toAccountId: z.string().cuid("Invalid To Account ID").optional(),
  categoryId: z.string().cuid("Invalid Category ID").optional(),
  subcategoryId: z.string().cuid("Invalid Subcategory ID").optional(),
  
  merchant: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  
  isRecurring: z.boolean().default(false),
})

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  type: z.nativeEnum(TransactionType),
  icon: z.string().optional(),
  color: z.string().optional(),
})
