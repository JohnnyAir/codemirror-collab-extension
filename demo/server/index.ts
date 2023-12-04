import http from 'http'
import { Server, Socket } from 'socket.io'
import { DocumentService } from './service'

const httpServer = http.createServer()
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
  },
})
const documentService = new DocumentService()

io.on('connection', (socket: Socket) => {
  console.log('A user connected')

  socket.on('getDocument', (callback) => {
    callback(documentService.getDoc())
  })

  socket.on('pullDocumentUpdates', (version: any) => {
    return documentService.getUpdates(version)
  })

  socket.on('updateDocument', (updateDocumentDto: any) => {
    const json = documentService.update(updateDocumentDto)
    io.emit('updatesRecieved', json)
    return json
  })

  socket.on('pushSelection', (selections: any) => {
    return socket.broadcast.emit('peer-selection', selections)
  })

  socket.on('disconnect', () => {
    socket.broadcast.emit('peer-selection', {
      id: socket.id,
      disconnected: true,
    })
  })
})

const PORT = process.env.PORT || 4000

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
