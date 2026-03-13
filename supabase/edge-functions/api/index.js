// Supabase Edge Function for the trucking app API
// This replaces the Node.js server for deployment to Supabase

import { createClient } from '@supabase/supabase-js'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// JWT secret for authentication
const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-secret-key'

// Import JWT functions (we'll need to adapt these for Deno)
import { verifyJWT, generateJWT } from '../utils/jwt.js'

// Helper function to handle CORS
function setCORSHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  return response
}

// Helper function to send JSON response
function sendJSON(data, status = 200) {
  const response = new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
  return setCORSHeaders(response)
}

// Helper function to handle errors
function handleError(error, message = 'Internal server error') {
  console.error('Error:', error)
  return sendJSON({ error: message }, 500)
}

// Authentication middleware
async function authenticateRequest(request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    const payload = await verifyJWT(token, JWT_SECRET)
    return payload
  } catch (error) {
    return null
  }
}

// API Routes
async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return setCORSHeaders(new Response(null, { status: 204 }))
  }

  // Authentication required routes
  if (path.startsWith('/api/users') && method !== 'POST') {
    const user = await authenticateRequest(request)
    if (!user) {
      return sendJSON({ error: 'Unauthorized' }, 401)
    }
  }

  try {
    // User registration
    if (path === '/api/users/register' && method === 'POST') {
      const { username, email, password } = await request.json()

      // Hash password (you'll need to implement this for Deno)
      const passwordHash = await hashPassword(password)

      const { data, error } = await supabase
        .from('users')
        .insert([
          { username, email, password_hash: passwordHash }
        ])
        .select()

      if (error) throw error

      return sendJSON({ message: 'User registered successfully' })
    }

    // User login
    if (path === '/api/users/login' && method === 'POST') {
      const { username, password } = await request.json()

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single()

      if (error || !user) {
        return sendJSON({ error: 'Invalid credentials' }, 401)
      }

      // Verify password (implement for Deno)
      const isValidPassword = await verifyPassword(password, user.password_hash)
      if (!isValidPassword) {
        return sendJSON({ error: 'Invalid credentials' }, 401)
      }

      const token = await generateJWT({ userId: user.id }, JWT_SECRET, '24h')

      return sendJSON({
        message: 'Login successful',
        token,
        user: { id: user.id, username: user.username, email: user.email }
      })
    }

    // Get user settings
    if (path === '/api/users/settings' && method === 'GET') {
      const user = await authenticateRequest(request)
      if (!user) {
        return sendJSON({ error: 'Unauthorized' }, 401)
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }

      return sendJSON(data || {})
    }

    // Save user settings
    if (path === '/api/users/settings' && method === 'PUT') {
      const user = await authenticateRequest(request)
      if (!user) {
        return sendJSON({ error: 'Unauthorized' }, 401)
      }

      const settingsData = await request.json()

      // Check if settings exist
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.userId)
        .single()

      let result
      if (existingSettings) {
        // Update existing settings
        const { data, error } = await supabase
          .from('user_settings')
          .update(settingsData)
          .eq('user_id', user.userId)
          .select()

        if (error) throw error
        result = data[0]
      } else {
        // Create new settings
        const { data, error } = await supabase
          .from('user_settings')
          .insert([{ ...settingsData, user_id: user.userId }])
          .select()

        if (error) throw error
        result = data[0]
      }

      return sendJSON(result)
    }

    // Get loads
    if (path === '/api/loads' && method === 'GET') {
      const user = await authenticateRequest(request)
      if (!user) {
        return sendJSON({ error: 'Unauthorized' }, 401)
      }

      const { data, error } = await supabase
        .from('loads')
        .select('*')
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return sendJSON(data || [])
    }

    // Create load
    if (path === '/api/loads' && method === 'POST') {
      const user = await authenticateRequest(request)
      if (!user) {
        return sendJSON({ error: 'Unauthorized' }, 401)
      }

      const loadData = await request.json()

      const { data, error } = await supabase
        .from('loads')
        .insert([{ ...loadData, user_id: user.userId }])
        .select()

      if (error) throw error

      return sendJSON(data[0])
    }

    // Update load
    if (path.match(/^\/api\/loads\/[^/]+$/) && method === 'PUT') {
      const user = await authenticateRequest(request)
      if (!user) {
        return sendJSON({ error: 'Unauthorized' }, 401)
      }

      const loadId = path.split('/')[3]
      const updateData = await request.json()

      const { data, error } = await supabase
        .from('loads')
        .update(updateData)
        .eq('id', loadId)
        .eq('user_id', user.userId)
        .select()

      if (error) throw error

      return sendJSON(data[0])
    }

    // Delete load
    if (path.match(/^\/api\/loads\/[^/]+$/) && method === 'DELETE') {
      const user = await authenticateRequest(request)
      if (!user) {
        return sendJSON({ error: 'Unauthorized' }, 401)
      }

      const loadId = path.split('/')[3]

      const { error } = await supabase
        .from('loads')
        .delete()
        .eq('id', loadId)
        .eq('user_id', user.userId)

      if (error) throw error

      return sendJSON({ message: 'Load deleted successfully' })
    }

    // Get fuel stops
    if (path === '/api/fuel-stops' && method === 'GET') {
      const user = await authenticateRequest(request)
      if (!user) {
        return sendJSON({ error: 'Unauthorized' }, 401)
      }

      const { data, error } = await supabase
        .from('fuel_stops')
        .select('*')
        .eq('user_id', user.userId)
        .order('date', { ascending: false })

      if (error) throw error

      return sendJSON(data || [])
    }

    // Create fuel stop
    if (path === '/api/fuel-stops' && method === 'POST') {
      const user = await authenticateRequest(request)
      if (!user) {
        return sendJSON({ error: 'Unauthorized' }, 401)
      }

      const fuelStopData = await request.json()

      const { data, error } = await supabase
        .from('fuel_stops')
        .insert([{ ...fuelStopData, user_id: user.userId }])
        .select()

      if (error) throw error

      return sendJSON(data[0])
    }

    // Submit bug report
    if (path === '/api/bug-reports' && method === 'POST') {
      const user = await authenticateRequest(request)
      if (!user) {
        return sendJSON({ error: 'Unauthorized' }, 401)
      }

      const { description } = await request.json()

      const { data, error } = await supabase
        .from('bug_reports')
        .insert([{ user_id: user.userId, description }])
        .select()

      if (error) throw error

      return sendJSON({ message: 'Bug report submitted successfully' })
    }

    // 404 Not Found
    return sendJSON({ error: 'Not found' }, 404)

  } catch (error) {
    return handleError(error)
  }
}

// Start the server
serve(handleRequest)