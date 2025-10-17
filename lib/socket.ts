import { Server as NetServer } from "http"
import { Server as SocketIOServer } from "socket.io"

let io: SocketIOServer | null = null

export const getSocketServer = () => {
  return io
}

export const initializeSocket = (httpServer: NetServer) => {
  if (!io) {
    io = new SocketIOServer(httpServer, {
      path: "/api/socket/io",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    })
    
    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id)
      
      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id)
      })
    })
  }
  return io
}

