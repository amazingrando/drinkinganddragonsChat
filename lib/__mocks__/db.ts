import { mockDeep } from 'jest-mock-extended'
import { PrismaClient } from '@prisma/client'

export const db = mockDeep<PrismaClient>()

