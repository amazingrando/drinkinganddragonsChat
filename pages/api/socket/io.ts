import {Server as NetServer} from "http"
import NextApiRequest from "next"
import { Server as SocketIOServer } from "socket.io"

import { NextApiResponseServerIo } from "@/types"

export const config = {
  api: {
    bodyParser: false,
  },
}

const ioHandler = (req: typeof NextApiRequest, res: NextApiResponseServerIo) => {
  if (!res.socket.server.io) {
    const path = "/api/socket/io"
    // Cast to 'any' before casting to NetServer to fix the type error
    const httpServer = res.socket.server as unknown as NetServer
    const io = new SocketIOServer(httpServer, {
      path,
      addTrailingSlash: false,
    })
    res.socket.server.io = io
  }

  res.end()
}

export default ioHandler
