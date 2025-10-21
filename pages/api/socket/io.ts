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
    
    res.socket.server.io = io
  }

  res.end()
}

export default ioHandler