require('dotenv').config()
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const axios = require('axios')

const APP_URL = process.env.APP_URL
const BOT_SECRET = process.env.BOT_SECRET

if (!APP_URL || !BOT_SECRET) {
  console.error('❌ Configure APP_URL e BOT_SECRET no arquivo .env')
  process.exit(1)
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  },
})

// ─── Eventos ───────────────────────────────────────────────────────────────

client.on('qr', (qr) => {
  console.log('\n📱 Escaneie o QR code abaixo com o WhatsApp:\n')
  qrcode.generate(qr, { small: true })
  console.log('\n⚠️  O QR code expira em 60 segundos. Escaneie rápido!\n')
})

client.on('authenticated', () => {
  console.log('✅ Autenticado com sucesso!')
})

client.on('auth_failure', (msg) => {
  console.error('❌ Falha na autenticação:', msg)
})

client.on('ready', () => {
  console.log('🤖 Bot FinanceApp está online e pronto!')
  console.log(`🔗 Webhook: ${APP_URL}/api/whatsapp`)
})

client.on('disconnected', (reason) => {
  console.log('❌ Bot desconectado:', reason)
  // Tenta reconectar após 5 segundos
  setTimeout(() => {
    console.log('🔄 Tentando reconectar...')
    client.initialize()
  }, 5000)
})

// ─── Mensagens ─────────────────────────────────────────────────────────────

client.on('message', async (msg) => {
  // Ignora grupos
  if (msg.from.includes('@g.us')) return
  // Ignora status
  if (msg.from === 'status@broadcast') return
  // Ignora mensagens do próprio bot
  if (msg.fromMe) return

  const from = msg.from.replace('@c.us', '') // ex: 5511999999999
  const message = msg.body.trim()

  if (!message) return

  console.log(`📨 [${new Date().toLocaleTimeString('pt-BR')}] De ${from}: ${message}`)

  try {
    const { data } = await axios.post(
      `${APP_URL}/api/whatsapp`,
      { from, message },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': BOT_SECRET,
        },
        timeout: 15000,
      }
    )

    if (data.reply) {
      await msg.reply(data.reply)
      console.log(`📤 Resposta enviada para ${from}`)
    }
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error.message)
    await msg.reply('❌ Ocorreu um erro. Tente novamente em instantes.')
  }
})

// ─── Inicia o cliente ───────────────────────────────────────────────────────

console.log('🚀 Iniciando bot FinanceApp...')
client.initialize()

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando bot...')
  await client.destroy()
  process.exit(0)
})
