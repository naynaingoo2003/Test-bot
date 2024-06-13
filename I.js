import { Router } from 'itty-router'
import { handleScheduled } from './cron'

const router = Router()

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

// Function to get updates using long polling
const getUpdates = async (offset = null, limit = 100, timeout = 0) => {
  const params = new URLSearchParams({ offset, limit, timeout })
  const response = await fetch(`${TELEGRAM_API}/getUpdates?${params.toString()}`)
  const result = await response.json()
  return result.ok ? result.result : []
}

// Function to send a message
const sendMessage = async (chatId, text) => {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  })
  if (!response.ok) {
    console.error(`Failed to send message. Status code: ${response.status}`)
  }
}

// Fetch coin information by address
const findCoin = async (address) => {
  const response = await fetch(`https://explorer-api-testnet.morphl2.io/api/v2/tokens/${address}`)
  if (response.ok) {
    const data = await response.json()
    return `Coin info:\nName: ${data.name}\nSymbol: ${data.symbol}\nToken Type: ${data.type}\nExchange Rate: ${data.exchange_rate}\nDecimals: ${data.decimals}\nTotal Supply: ${data.total_supply}\nNo.of Holders: ${data.holders}`
  }
  return "Failed to fetch coin information"
}

// Fetch coin information by name and type
const findCoinByName = async (name, type) => {
  const response = await fetch(`https://explorer-api-testnet.morphl2.io/api/v2/tokens/?q=${name}&type=${type}`)
  if (response.ok) {
    const data = await response.json()
    if (data.items) {
      return data.items.slice(0, 5).map(item => (
        `Name: ${item.name}\nSymbol: ${item.symbol}\nAddress: ${item.address}\nDecimals: ${item.decimals}\nTotal Supply: ${item.total_supply}\nExchange Rate: ${item.exchange_rate}\nNo. of Holders: ${item.holders}`
      )).join('\n\n')
    }
    return "No tokens found for the provided criteria."
  }
  return "Failed to fetch token information."
}

// Handle incoming updates
const processUpdates = async (updates) => {
  for (const update of updates) {
    const chatId = update.message?.chat?.id
    const text = update.message?.text

    if (!chatId || !text) continue

    if (text === '/start') {
      await sendMessage(chatId, "Welcome to Morph explorer run /help to get all commands")
    } else if (text.startsWith('/TokenByAddress ')) {
      await sendMessage(chatId, "Please wait, fetching data...")
      const address = text.split('/TokenByAddress ')[1].trim()
      const coinInfo = await findCoin(address)
      await sendMessage(chatId, coinInfo)
    } else if (text.startsWith('/TokenByName ')) {
      const [_, name, type] = text.split(' ')
      if (name && type) {
        await sendMessage(chatId, "Please wait, fetching data...")
        const coinInfo = await findCoinByName(name, type)
        await sendMessage(chatId, coinInfo)
      } else {
        await sendMessage(chatId, "Please provide both the coin name and type. use /help for help")
      }
    } else {
      await sendMessage(chatId, "Invalid command. Please use /help to see all commands")
    }
  }
}

// Main function to continuously fetch and process updates
router.get('/updates', async () => {
  let offset = null
  const updates = await getUpdates(offset)
  if (updates.length) {
    await processUpdates(updates)
    offset = updates[updates.length - 1].update_id + 1
  }
  return new Response('OK')
})

// Worker event listeners
addEventListener('fetch', event => {
  event.respondWith(router.handle(event.request))
})
