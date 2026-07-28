/**
 * One-time setup script to register the Telegram webhook URL.
 *
 * Usage:
 *   npx tsx scripts/setup-webhook.ts <your-public-url>
 *
 * Example:
 *   npx tsx scripts/setup-webhook.ts https://your-app.vercel.app/api/telegram
 *   npx tsx scripts/setup-webhook.ts https://abc123.ngrok.io/api/telegram
 */

import 'dotenv/config'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env')
  process.exit(1)
}

const url = process.argv[2]

if (!url) {
  console.error('❌ Please provide the webhook URL as an argument.')
  console.error('   Usage: npx tsx scripts/setup-webhook.ts <url>')
  console.error('   Example: npx tsx scripts/setup-webhook.ts https://your-app.vercel.app/api/telegram')
  process.exit(1)
}

async function main() {
  console.log(`🔗 Setting webhook to: ${url}`)

  const body: Record<string, string> = { url }
  if (WEBHOOK_SECRET) {
    body.secret_token = WEBHOOK_SECRET
    console.log('🔒 Using webhook secret for validation')
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (data.ok) {
    console.log('✅ Webhook registered successfully!')
    console.log(`   URL: ${url}`)
  } else {
    console.error('❌ Failed to register webhook:')
    console.error(data)
    process.exit(1)
  }

  // Also set bot commands for the menu
  console.log('\n📋 Setting bot commands...')
  const commandsRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'add', description: 'Log an expense — /add <amount> [category] [merchant]' },
        { command: 'income', description: 'Log income — /income <amount> [category] [desc]' },
        { command: 'summary', description: 'Monthly spending summary' },
        { command: 'recent', description: 'Show recent transactions' },
        { command: 'accounts', description: 'List all accounts' },
        { command: 'categories', description: 'List all categories' },
        { command: 'help', description: 'Show all commands' },
      ],
    }),
  })

  const commandsData = await commandsRes.json()
  if (commandsData.ok) {
    console.log('✅ Bot commands menu registered!')
  } else {
    console.error('⚠️  Failed to set bot commands:', commandsData)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
