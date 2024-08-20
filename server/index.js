import express from 'express'
import logger from 'morgan'

import { Server } from 'socket.io'
import { createServer } from 'http'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

dotenv.config()
const port = process.env.PORT || 3000

const app = express()
const server = createServer(app)
const io = new Server(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 60000,
  },
})
const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.ENCRYPTION_KEY,
})

await db.execute(
  'CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, date TEXT, userName TEXT, userAvatar TEXT)',
)

io.on('connection', async (socket) => {
  console.log('a user connected')
  socket.on('disconnect', () => {
    console.log('user disconnected')
  })

  socket.on('message', async (msg) => {
    try {
      await db.execute({
        sql: 'INSERT INTO messages (message, date, userName, userAvatar) VALUES (:message, :date, :userName, :userAvatar)',
        args: {
          message: msg.message,
          date: msg.date,
          userName: msg.userName,
          userAvatar: msg.userAvatar,
        },
      })
    } catch (error) {
      console.error(error)
    }
    io.emit('message', msg)
  })

  if (!socket.recovered) {
    try {
      const results = await db.execute('SELECT * FROM messages')
      results.rows.forEach((row) => {
        socket.emit('message', row)
      })
    } catch (error) {
      console.error(error)
    }
  }
})

app.use(logger('dev'))

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
