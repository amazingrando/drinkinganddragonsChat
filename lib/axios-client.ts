import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

/**
 * Client-side helper to get CSRF token from cookie
 * Since the CSRF token cookie is not httpOnly, we can read it directly from the client
 */
function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookies = document.cookie.split(';')
  const csrfCookie = cookies.find((cookie) => cookie.trim().startsWith('csrf-token='))
  
  if (!csrfCookie) {
    return null
  }

  return csrfCookie.split('=')[1]?.trim() || null
}

/**
 * Fetches a CSRF token from the API if not found in cookies
 */
async function fetchCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    })
    
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.token || null
  } catch {
    return null
  }
}

/**
 * Gets CSRF token from cookie or fetches a new one if needed
 */
async function getCsrfToken(): Promise<string | null> {
  // Try to get from cookie first
  let token = getCsrfTokenFromCookie()
  
  // If not found, fetch from API
  if (!token) {
    token = await fetchCsrfToken()
  }
  
  return token
}

/**
 * State-changing HTTP methods that require CSRF protection
 */
const CSRF_PROTECTED_METHODS = ['POST', 'PATCH', 'DELETE', 'PUT']

/**
 * Creates an axios instance with automatic CSRF token injection
 * The interceptor automatically adds CSRF tokens to state-changing requests
 */
function createAxiosInstance(): AxiosInstance {
  const instance = axios.create({
    withCredentials: true,
  })

  // Request interceptor to add CSRF token
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Only add CSRF token for state-changing methods
      if (config.method && CSRF_PROTECTED_METHODS.includes(config.method.toUpperCase())) {
        const token = await getCsrfToken()
        
        if (token && config.headers) {
          // Set header - works with both plain objects and Headers instances
          if (typeof config.headers.set === 'function') {
            config.headers.set('x-csrf-token', token)
          } else {
            config.headers['x-csrf-token'] = token
          }
        }
      }
      
      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  return instance
}

/**
 * Axios instance with automatic CSRF token support
 * Use this instead of the default axios import for authenticated requests
 */
export const axiosClient = createAxiosInstance()

// Re-export axios for compatibility
export default axiosClient

