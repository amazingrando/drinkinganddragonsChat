// Jest setup file
// This file runs before each test file

// Extend Jest matchers with @testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock Next.js headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

// Mock database and profile functions
jest.mock('@/lib/db', () => {
  // Use import instead of require for compliance with lint rules
  const { mockDeep } = jest.requireActual('jest-mock-extended')
  // PrismaClient import not used, so removed to comply with lint rules
  return { db: mockDeep() }
})

jest.mock('@/lib/current-profile', () => ({
  currentProfile: jest.fn(),
}))

jest.mock('@/lib/supabase/server-broadcast', () => ({
  broadcastMessage: jest.fn(),
}))

// Suppress console errors in tests (optional, uncomment if needed)
// global.console = {
//   ...console,
//   error: jest.fn(),
// }
