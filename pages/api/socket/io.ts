import { Server as NetServer } from "http"
import { NextApiRequest, NextApiResponse } from "next"
import { Server as SocketIOServer } from "socket.io"
import { NextApiResponseServerIo } from "@/types"

export const config = {
  api: {
    bodyParser: false,
  },
}

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIo) => {
  if (!res.socket.server.io) {
    const path = "/api/socket/io"
    const httpServer = res.socket.server as unknown as NetServer
    const io = new SocketIOServer(httpServer, {
      path,
      addTrailingSlash: false,
      cors: {
        origin: process.env.NODE_ENV === "production" 
          ? [process.env.NEXT_PUBLIC_SITE_URL!] 
          : "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ["websocket", "polling"],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 10000,
      allowEIO3: true,
    })
    
    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id)
      
      // Send ping to keep connection alive
      socket.on("ping", () => {
        socket.emit("pong")
      })
      
      socket.on("disconnect", (reason) => {
        console.log("Client disconnected:", socket.id, "Reason:", reason)
      })
      
      socket.on("error", (error) => {
        console.error("Socket error:", socket.id, error)
      })
    })
    
    res.socket.server.io = io
  }

  res.end()
}

export default ioHandler