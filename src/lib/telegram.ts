/**
 * Telegram Bot API helper functions.
 * Wraps the Telegram HTTP API for sending messages, inline keyboards, and webhook management.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

export interface InlineKeyboardButton {
  text: string
  callback_data: string
}

export interface SendMessageOptions {
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML'
  reply_markup?: {
    inline_keyboard?: InlineKeyboardButton[][]
  }
}

/**
 * Send a text message to a Telegram chat.
 */
export async function sendMessage(
  chatId: number | bigint | string,
  text: string,
  options?: SendMessageOptions
): Promise<void> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId.toString(),
      text,
    }

    if (options?.parse_mode) {
      body.parse_mode = options.parse_mode
    }

    if (options?.reply_markup) {
      body.reply_markup = options.reply_markup
    }

    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      console.error('[TELEGRAM_SEND]', res.status, errorData)
    }
  } catch (error) {
    console.error('[TELEGRAM_SEND_ERROR]', error)
  }
}

/**
 * Send a message with inline keyboard buttons.
 * Buttons are arranged in rows — each inner array is one row.
 */
export async function sendInlineKeyboard(
  chatId: number | bigint | string,
  text: string,
  buttons: InlineKeyboardButton[][]
): Promise<void> {
  await sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: buttons },
  })
}

/**
 * Answer a callback query (dismisses the "loading" spinner on button press).
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || '',
      }),
    })
  } catch (error) {
    console.error('[TELEGRAM_ANSWER_CALLBACK]', error)
  }
}

/**
 * Register the webhook URL with Telegram.
 * Called once during setup via the setup script.
 */
export async function setWebhook(url: string, secret?: string): Promise<{ ok: boolean; description?: string }> {
  const body: Record<string, string> = { url }
  if (secret) body.secret_token = secret

  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return res.json()
}

/**
 * Format a number as Indian currency (₹).
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

/**
 * Escape special characters for Telegram MarkdownV2.
 * Characters that need escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
}
