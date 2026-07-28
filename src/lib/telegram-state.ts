/**
 * In-memory conversation state manager for multi-step Telegram interactions.
 *
 * When a user types `/add 450` without specifying a category, we need to remember
 * the amount and wait for them to tap a category button. This module stores
 * that pending state keyed by chat ID.
 *
 * Note: This is in-memory and resets on server restart. For a personal finance bot
 * with a single user, this is perfectly fine. For multi-user production, you'd
 * want to use Redis or the database.
 */

export interface PendingTransaction {
  action: 'add_expense' | 'add_income'
  amount: number
  merchant?: string
  /** Set after the user picks a category via inline keyboard */
  categoryId?: string
  /** Set after the user picks an account via inline keyboard */
  accountId?: string
  /** What we're currently waiting for */
  waitingFor: 'category' | 'account' | null
}

/** Map of chatId (as string) → pending transaction state */
const pendingStates = new Map<string, PendingTransaction>()

export function getPendingState(chatId: string | number | bigint): PendingTransaction | undefined {
  return pendingStates.get(chatId.toString())
}

export function setPendingState(chatId: string | number | bigint, state: PendingTransaction): void {
  pendingStates.set(chatId.toString(), state)
}

export function clearPendingState(chatId: string | number | bigint): void {
  pendingStates.delete(chatId.toString())
}

export function hasPendingState(chatId: string | number | bigint): boolean {
  return pendingStates.has(chatId.toString())
}
