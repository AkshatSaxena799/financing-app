import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendMessage,
  sendInlineKeyboard,
  answerCallbackQuery,
  formatCurrency,
} from '@/lib/telegram'
import {
  getPendingState,
  setPendingState,
  clearPendingState,
  type PendingTransaction,
} from '@/lib/telegram-state'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: { id: number; first_name: string; username?: string }
    chat: { id: number; type: string }
    date: number
    text?: string
  }
  callback_query?: {
    id: string
    from: { id: number; first_name: string }
    message: { chat: { id: number } }
    data: string
  }
}

// ─── POST Handler (Telegram Webhook) ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Validate webhook secret if configured
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (secret) {
      const headerSecret = req.headers.get('x-telegram-bot-api-secret-token')
      if (headerSecret !== secret) {
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    const update: TelegramUpdate = await req.json()

    // Handle callback queries (inline keyboard button presses)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query)
      return NextResponse.json({ ok: true })
    }

    // Handle text messages
    if (update.message?.text) {
      const chatId = update.message.chat.id
      const text = update.message.text.trim()

      if (text.startsWith('/')) {
        await handleCommand(chatId, text)
      } else {
        await sendMessage(chatId, '💡 Send /help to see available commands.')
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[TELEGRAM_WEBHOOK]', error)
    // Always return 200 to Telegram to prevent retries
    return NextResponse.json({ ok: true })
  }
}

// ─── Command Router ─────────────────────────────────────────────────────────

async function handleCommand(chatId: number, text: string) {
  const parts = text.split(/\s+/)
  const command = parts[0].toLowerCase().replace(/@\w+$/, '') // Strip @botname suffix

  switch (command) {
    case '/start':
      return handleStart(chatId)
    case '/help':
      return handleHelp(chatId)
    case '/link':
      return handleLink(chatId, parts.slice(1))
    case '/add':
      return handleAdd(chatId, parts.slice(1))
    case '/income':
      return handleIncome(chatId, parts.slice(1))
    case '/summary':
      return handleSummary(chatId)
    case '/accounts':
      return handleAccounts(chatId)
    case '/categories':
      return handleCategories(chatId)
    case '/recent':
      return handleRecent(chatId, parts[1])
    case '/delete':
      return handleDelete(chatId, parts[1])
    default:
      return sendMessage(chatId, `❓ Unknown command: ${command}\nSend /help for available commands.`)
  }
}

// ─── /start ─────────────────────────────────────────────────────────────────

async function handleStart(chatId: number) {
  const user = await findUserByChatId(chatId)

  if (user) {
    await sendMessage(
      chatId,
      `👋 Welcome back, ${user.firstName || 'there'}!\n\n` +
      `Your account is already linked. Send /help to see what I can do.`
    )
  } else {
    await sendMessage(
      chatId,
      `👋 Welcome to your Personal Finance Bot!\n\n` +
      `To get started, link your account:\n` +
      `/link <your-clerk-user-id>\n\n` +
      `You can find your Clerk user ID in your web dashboard profile.\n\n` +
      `Once linked, you can log expenses right from here! 💸`
    )
  }
}

// ─── /help ──────────────────────────────────────────────────────────────────

async function handleHelp(chatId: number) {
  await sendMessage(
    chatId,
    `📖 *Available Commands*\n\n` +
    `💸 *Transactions*\n` +
    `/add <amount> <category> [merchant] — Log an expense\n` +
    `/income <amount> <category> [description] — Log income\n` +
    `/recent [count] — Show recent transactions\n` +
    `/delete <transaction-id> — Delete a transaction\n\n` +
    `📊 *Overview*\n` +
    `/summary — Monthly spending summary\n` +
    `/accounts — List all accounts\n` +
    `/categories — List categories\n\n` +
    `⚙️ *Setup*\n` +
    `/link <clerk-user-id> — Link your account\n` +
    `/help — Show this message`,
    { parse_mode: 'Markdown' }
  )
}

// ─── /link ──────────────────────────────────────────────────────────────────

async function handleLink(chatId: number, args: string[]) {
  if (args.length === 0) {
    return sendMessage(chatId, '⚠️ Usage: /link <your-clerk-user-id>\n\nExample: /link user_2abc123')
  }

  const clerkUserId = args[0]

  try {
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    })

    if (!user) {
      return sendMessage(chatId, '❌ No account found with that Clerk user ID.\nMake sure you\'ve signed in to the web app at least once.')
    }

    // Check if this chat is already linked to a different user
    const existingLink = await prisma.user.findUnique({
      where: { telegramChatId: BigInt(chatId) },
    })

    if (existingLink && existingLink.id !== user.id) {
      return sendMessage(chatId, '⚠️ This Telegram chat is already linked to a different account.')
    }

    // Link the Telegram chat to the user
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: BigInt(chatId) },
    })

    await sendMessage(
      chatId,
      `✅ Linked to ${user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email}'s account!\n\n` +
      `You're all set. Try /add 100 Food Zomato to log your first expense! 🎉`
    )
  } catch (error) {
    console.error('[TELEGRAM_LINK]', error)
    await sendMessage(chatId, '❌ Failed to link account. Please try again.')
  }
}

// ─── /add ───────────────────────────────────────────────────────────────────

async function handleAdd(chatId: number, args: string[]) {
  const user = await findUserByChatId(chatId)
  if (!user) return sendNotLinkedMessage(chatId)

  if (args.length === 0) {
    return sendMessage(chatId, '⚠️ Usage: /add <amount> [category] [merchant]\n\nExamples:\n/add 450 Food Swiggy\n/add 1200 Transport Uber\n/add 500')
  }

  const amount = parseFloat(args[0])
  if (isNaN(amount) || amount <= 0) {
    return sendMessage(chatId, '❌ Invalid amount. Please enter a positive number.\n\nExample: /add 450 Food Swiggy')
  }

  const categoryName = args[1] || null
  const merchant = args.slice(2).join(' ') || null

  // Try to find the category by name (case-insensitive partial match)
  let category = null
  if (categoryName) {
    category = await prisma.category.findFirst({
      where: {
        userId: user.id,
        name: { contains: categoryName, mode: 'insensitive' },
        type: 'EXPENSE',
      },
    })
  }

  // If no category specified or not found, show category picker
  if (!category) {
    const categories = await prisma.category.findMany({
      where: { userId: user.id, type: 'EXPENSE' },
      orderBy: { name: 'asc' },
    })

    if (categories.length === 0) {
      return sendMessage(chatId, '❌ No expense categories found.\nCreate categories from the web dashboard first.')
    }

    // Store pending state
    setPendingState(chatId, {
      action: 'add_expense',
      amount,
      merchant: merchant || undefined,
      waitingFor: 'category',
    })

    // Show category buttons (2 per row)
    const buttons = []
    for (let i = 0; i < categories.length; i += 2) {
      const row = [{ text: categories[i].name, callback_data: `cat:${categories[i].id}` }]
      if (categories[i + 1]) {
        row.push({ text: categories[i + 1].name, callback_data: `cat:${categories[i + 1].id}` })
      }
      buttons.push(row)
    }
    buttons.push([{ text: '❌ Cancel', callback_data: 'cancel' }])

    return sendInlineKeyboard(
      chatId,
      `💸 Logging expense of ${formatCurrency(amount)}${merchant ? ` at ${merchant}` : ''}\n\nPick a category:`,
      buttons
    )
  }

  // We have category — now find the default account
  await createExpenseTransaction(chatId, user.id, amount, category.id, category.name, merchant)
}

// ─── /income ────────────────────────────────────────────────────────────────

async function handleIncome(chatId: number, args: string[]) {
  const user = await findUserByChatId(chatId)
  if (!user) return sendNotLinkedMessage(chatId)

  if (args.length === 0) {
    return sendMessage(chatId, '⚠️ Usage: /income <amount> [category] [description]\n\nExample: /income 150000 Salary Acme Corp')
  }

  const amount = parseFloat(args[0])
  if (isNaN(amount) || amount <= 0) {
    return sendMessage(chatId, '❌ Invalid amount. Please enter a positive number.')
  }

  const categoryName = args[1] || null
  const description = args.slice(2).join(' ') || null

  let category = null
  if (categoryName) {
    category = await prisma.category.findFirst({
      where: {
        userId: user.id,
        name: { contains: categoryName, mode: 'insensitive' },
        type: 'INCOME',
      },
    })
  }

  if (!category) {
    const categories = await prisma.category.findMany({
      where: { userId: user.id, type: 'INCOME' },
      orderBy: { name: 'asc' },
    })

    if (categories.length === 0) {
      return sendMessage(chatId, '❌ No income categories found.\nCreate categories from the web dashboard first.')
    }

    setPendingState(chatId, {
      action: 'add_income',
      amount,
      merchant: description || undefined,
      waitingFor: 'category',
    })

    const buttons = []
    for (let i = 0; i < categories.length; i += 2) {
      const row = [{ text: categories[i].name, callback_data: `cat:${categories[i].id}` }]
      if (categories[i + 1]) {
        row.push({ text: categories[i + 1].name, callback_data: `cat:${categories[i + 1].id}` })
      }
      buttons.push(row)
    }
    buttons.push([{ text: '❌ Cancel', callback_data: 'cancel' }])

    return sendInlineKeyboard(
      chatId,
      `💰 Logging income of ${formatCurrency(amount)}${description ? ` — ${description}` : ''}\n\nPick a category:`,
      buttons
    )
  }

  await createIncomeTransaction(chatId, user.id, amount, category.id, category.name, description)
}

// ─── /summary ───────────────────────────────────────────────────────────────

async function handleSummary(chatId: number) {
  const user = await findUserByChatId(chatId)
  if (!user) return sendNotLinkedMessage(chatId)

  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' })

    // Net worth
    const accounts = await prisma.account.findMany({ where: { userId: user.id } })
    const netWorth = accounts.reduce((acc, a) => acc + a.currentBalance, 0)

    // Monthly spend
    const monthlyAgg = await prisma.transaction.aggregate({
      where: { userId: user.id, type: 'EXPENSE', date: { gte: startOfMonth } },
      _sum: { amount: true },
    })
    const monthlySpend = monthlyAgg._sum.amount || 0

    // Today's spend
    const todayAgg = await prisma.transaction.aggregate({
      where: { userId: user.id, type: 'EXPENSE', date: { gte: startOfToday } },
      _sum: { amount: true },
    })
    const todaySpend = todayAgg._sum.amount || 0

    // Monthly income
    const incomeAgg = await prisma.transaction.aggregate({
      where: { userId: user.id, type: 'INCOME', date: { gte: startOfMonth } },
      _sum: { amount: true },
    })
    const monthlyIncome = incomeAgg._sum.amount || 0

    // Top categories
    const categoryBreakdown = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId: user.id,
        type: 'EXPENSE',
        date: { gte: startOfMonth },
        categoryId: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    })

    const categoryIds = categoryBreakdown.map((c) => c.categoryId!)
    const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } })

    let categoriesText = ''
    if (categoryBreakdown.length > 0) {
      categoriesText = '\n\n📂 Top Categories:\n' + categoryBreakdown
        .map((cb) => {
          const cat = categories.find((c) => c.id === cb.categoryId)
          return `  • ${cat?.name || 'Unknown'}: ${formatCurrency(cb._sum.amount || 0)}`
        })
        .join('\n')
    }

    // Transaction count this month
    const txCount = await prisma.transaction.count({
      where: { userId: user.id, date: { gte: startOfMonth } },
    })

    await sendMessage(
      chatId,
      `📊 *${monthName} Summary*\n\n` +
      `💰 Net Worth: ${formatCurrency(netWorth)}\n` +
      `📈 Monthly Income: ${formatCurrency(monthlyIncome)}\n` +
      `📉 Monthly Spend: ${formatCurrency(monthlySpend)}\n` +
      `🕐 Today's Spend: ${formatCurrency(todaySpend)}\n` +
      `📝 Transactions: ${txCount}` +
      categoriesText,
      { parse_mode: 'Markdown' }
    )
  } catch (error) {
    console.error('[TELEGRAM_SUMMARY]', error)
    await sendMessage(chatId, '❌ Failed to load summary. Please try again.')
  }
}

// ─── /accounts ──────────────────────────────────────────────────────────────

async function handleAccounts(chatId: number) {
  const user = await findUserByChatId(chatId)
  if (!user) return sendNotLinkedMessage(chatId)

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  if (accounts.length === 0) {
    return sendMessage(chatId, '🏦 No accounts found.\nAdd accounts from the web dashboard first.')
  }

  const lines = accounts.map((acc) => {
    const type = acc.type.replace('_', ' ')
    const bank = acc.bankName ? ` (${acc.bankName})` : ''
    const balance = formatCurrency(acc.currentBalance)
    return `• ${acc.name}${bank}\n  ${type} — ${balance}`
  })

  await sendMessage(chatId, `🏦 *Your Accounts*\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown' })
}

// ─── /categories ────────────────────────────────────────────────────────────

async function handleCategories(chatId: number) {
  const user = await findUserByChatId(chatId)
  if (!user) return sendNotLinkedMessage(chatId)

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { type: 'asc' },
  })

  if (categories.length === 0) {
    return sendMessage(chatId, '📂 No categories found.\nCreate categories from the web dashboard.')
  }

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE')
  const incomeCategories = categories.filter((c) => c.type === 'INCOME')

  let text = '📂 *Your Categories*\n\n'

  if (expenseCategories.length > 0) {
    text += '💸 Expense:\n' + expenseCategories.map((c) => `  • ${c.name}`).join('\n') + '\n\n'
  }

  if (incomeCategories.length > 0) {
    text += '💰 Income:\n' + incomeCategories.map((c) => `  • ${c.name}`).join('\n')
  }

  await sendMessage(chatId, text, { parse_mode: 'Markdown' })
}

// ─── /recent ────────────────────────────────────────────────────────────────

async function handleRecent(chatId: number, countStr?: string) {
  const user = await findUserByChatId(chatId)
  if (!user) return sendNotLinkedMessage(chatId)

  const count = Math.min(Math.max(parseInt(countStr || '5') || 5, 1), 20)

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    include: { category: true, account: true },
    orderBy: { date: 'desc' },
    take: count,
  })

  if (transactions.length === 0) {
    return sendMessage(chatId, '📋 No transactions found. Log one with /add!')
  }

  const lines = transactions.map((tx) => {
    const date = tx.date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    const sign = tx.type === 'INCOME' || tx.type === 'REFUND' ? '+' : '-'
    const cat = tx.category?.name || 'Uncategorized'
    const desc = tx.merchant || tx.description || ''
    return `${date} | ${sign}${formatCurrency(tx.amount)} | ${cat}${desc ? ` | ${desc}` : ''}`
  })

  await sendMessage(chatId, `📋 *Last ${transactions.length} Transactions*\n\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
  })
}

// ─── /delete ────────────────────────────────────────────────────────────────

async function handleDelete(chatId: number, transactionId?: string) {
  const user = await findUserByChatId(chatId)
  if (!user) return sendNotLinkedMessage(chatId)

  if (!transactionId) {
    return sendMessage(chatId, '⚠️ Usage: /delete <transaction-id>\n\nUse /recent to find transaction IDs.')
  }

  try {
    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } })

    if (!tx || tx.userId !== user.id) {
      return sendMessage(chatId, '❌ Transaction not found.')
    }

    // Reverse the balance change
    await prisma.$transaction(async (ptx) => {
      let balanceReverse = 0
      if (tx.type === 'EXPENSE') balanceReverse = tx.amount
      else if (tx.type === 'INCOME' || tx.type === 'REFUND') balanceReverse = -tx.amount
      else if (tx.type === 'TRANSFER' && tx.toAccountId) {
        balanceReverse = tx.amount
        await ptx.account.update({
          where: { id: tx.toAccountId },
          data: { currentBalance: { decrement: tx.amount } },
        })
      }

      await ptx.account.update({
        where: { id: tx.accountId },
        data: { currentBalance: { increment: balanceReverse } },
      })

      await ptx.transaction.delete({ where: { id: transactionId } })
    })

    await sendMessage(chatId, `🗑️ Transaction deleted — ${formatCurrency(tx.amount)} reversed.`)
  } catch (error) {
    console.error('[TELEGRAM_DELETE]', error)
    await sendMessage(chatId, '❌ Failed to delete transaction. Please try again.')
  }
}

// ─── Callback Query Handler (Inline Keyboard) ──────────────────────────────

async function handleCallbackQuery(callbackQuery: NonNullable<TelegramUpdate['callback_query']>) {
  const chatId = callbackQuery.message.chat.id
  const data = callbackQuery.data

  // Always acknowledge the callback
  await answerCallbackQuery(callbackQuery.id)

  if (data === 'cancel') {
    clearPendingState(chatId)
    return sendMessage(chatId, '❌ Cancelled.')
  }

  const pending = getPendingState(chatId)
  if (!pending) {
    return sendMessage(chatId, '⏰ That interaction has expired. Please try again.')
  }

  // Category selection
  if (data.startsWith('cat:') && pending.waitingFor === 'category') {
    const categoryId = data.replace('cat:', '')
    pending.categoryId = categoryId
    pending.waitingFor = 'account'

    const user = await findUserByChatId(chatId)
    if (!user) return sendNotLinkedMessage(chatId)

    // Fetch accounts for account selection
    const accounts = await prisma.account.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    })

    if (accounts.length === 0) {
      clearPendingState(chatId)
      return sendMessage(chatId, '❌ No active accounts found. Add one from the web dashboard.')
    }

    // If only one account, use it directly
    if (accounts.length === 1) {
      pending.accountId = accounts[0].id
      setPendingState(chatId, pending)

      const category = await prisma.category.findUnique({ where: { id: categoryId } })
      if (pending.action === 'add_expense') {
        await createExpenseTransaction(chatId, user.id, pending.amount, categoryId, category?.name || 'Unknown', pending.merchant || null)
      } else {
        await createIncomeTransaction(chatId, user.id, pending.amount, categoryId, category?.name || 'Unknown', pending.merchant || null)
      }
      clearPendingState(chatId)
      return
    }

    // Show account selection buttons
    setPendingState(chatId, pending)
    const buttons = accounts.map((acc) => [
      { text: `${acc.name} (${formatCurrency(acc.currentBalance)})`, callback_data: `acc:${acc.id}` },
    ])
    buttons.push([{ text: '❌ Cancel', callback_data: 'cancel' }])

    return sendInlineKeyboard(chatId, '🏦 Pick an account:', buttons)
  }

  // Account selection
  if (data.startsWith('acc:') && pending.waitingFor === 'account') {
    const accountId = data.replace('acc:', '')
    pending.accountId = accountId

    const user = await findUserByChatId(chatId)
    if (!user) return sendNotLinkedMessage(chatId)

    const category = await prisma.category.findUnique({ where: { id: pending.categoryId! } })

    if (pending.action === 'add_expense') {
      await createExpenseTransaction(chatId, user.id, pending.amount, pending.categoryId!, category?.name || 'Unknown', pending.merchant || null, accountId)
    } else {
      await createIncomeTransaction(chatId, user.id, pending.amount, pending.categoryId!, category?.name || 'Unknown', pending.merchant || null, accountId)
    }
    clearPendingState(chatId)
  }
}

// ─── Transaction Creators ───────────────────────────────────────────────────

async function createExpenseTransaction(
  chatId: number,
  userId: string,
  amount: number,
  categoryId: string,
  categoryName: string,
  merchant: string | null,
  specificAccountId?: string
) {
  try {
    // Find default account (first active savings/current/wallet, or any active)
    let account
    if (specificAccountId) {
      account = await prisma.account.findUnique({ where: { id: specificAccountId } })
    } else {
      account = await prisma.account.findFirst({
        where: { userId, status: 'ACTIVE', type: { in: ['SAVINGS', 'CURRENT', 'WALLET'] } },
        orderBy: { createdAt: 'asc' },
      })
      if (!account) {
        account = await prisma.account.findFirst({
          where: { userId, status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        })
      }
    }

    if (!account) {
      return sendMessage(chatId, '❌ No active accounts found. Add one from the web dashboard first.')
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          amount,
          date: new Date(),
          type: 'EXPENSE',
          accountId: account.id,
          categoryId,
          merchant,
          userId,
        },
      })

      await tx.account.update({
        where: { id: account.id },
        data: { currentBalance: { decrement: amount } },
      })
    })

    const date = new Date().toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    await sendMessage(
      chatId,
      `💸 ${formatCurrency(amount)} logged under ${categoryName} from ${account.name}\n` +
      `${merchant ? `📝 ${merchant} | ` : ''}${date}`
    )
  } catch (error) {
    console.error('[TELEGRAM_ADD_EXPENSE]', error)
    await sendMessage(chatId, '❌ Failed to log expense. Please try again.')
  }
}

async function createIncomeTransaction(
  chatId: number,
  userId: string,
  amount: number,
  categoryId: string,
  categoryName: string,
  description: string | null,
  specificAccountId?: string
) {
  try {
    let account
    if (specificAccountId) {
      account = await prisma.account.findUnique({ where: { id: specificAccountId } })
    } else {
      account = await prisma.account.findFirst({
        where: { userId, status: 'ACTIVE', type: { in: ['SAVINGS', 'CURRENT'] } },
        orderBy: { createdAt: 'asc' },
      })
      if (!account) {
        account = await prisma.account.findFirst({
          where: { userId, status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        })
      }
    }

    if (!account) {
      return sendMessage(chatId, '❌ No active accounts found. Add one from the web dashboard first.')
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          amount,
          date: new Date(),
          type: 'INCOME',
          accountId: account.id,
          categoryId,
          description,
          userId,
        },
      })

      await tx.account.update({
        where: { id: account.id },
        data: { currentBalance: { increment: amount } },
      })
    })

    const date = new Date().toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    await sendMessage(
      chatId,
      `💰 ${formatCurrency(amount)} income logged under ${categoryName} to ${account.name}\n` +
      `${description ? `📝 ${description} | ` : ''}${date}`
    )
  } catch (error) {
    console.error('[TELEGRAM_ADD_INCOME]', error)
    await sendMessage(chatId, '❌ Failed to log income. Please try again.')
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function findUserByChatId(chatId: number) {
  try {
    return await prisma.user.findUnique({
      where: { telegramChatId: BigInt(chatId) },
    })
  } catch {
    return null
  }
}

async function sendNotLinkedMessage(chatId: number) {
  await sendMessage(
    chatId,
    '🔗 Your Telegram isn\'t linked to any account yet.\n\n' +
    'Send /link <your-clerk-user-id> to get started.\n' +
    'Find your Clerk user ID on your web dashboard profile.'
  )
}

// Also handle GET for health check / webhook verification
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    bot: 'Personal Finance Telegram Bot',
    webhook: 'active',
  })
}
