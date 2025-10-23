// IP-based geolocation API endpoint
// Uses ipapi.co (free tier: 1000 requests/day, no API key needed)
// Falls back to ip-api.com if first fails

const { getCached, setCached } = require('../../server/cache')

// State name normalization map to match API format
const stateNormalizationMap = {
  'Uttar Pradesh': 'UTTAR PRADESH',
  'Maharashtra': 'MAHARASHTRA',
  'Bihar': 'BIHAR',
  'West Bengal': 'WEST BENGAL',
  'Madhya Pradesh': 'MADHYA PRADESH',
  'Tamil Nadu': 'TAMIL NADU',
  'Rajasthan': 'RAJASTHAN',
  'Karnataka': 'KARNATAKA',
  'Gujarat': 'GUJARAT',
  'Andhra Pradesh': 'ANDHRA PRADESH',
  'Odisha': 'ODISHA',
  'Telangana': 'TELANGANA',
  'Kerala': 'KERALA',
  'Jharkhand': 'JHARKHAND',
  'Assam': 'ASSAM',
  'Punjab': 'PUNJAB',
  'Chhattisgarh': 'CHHATTISGARH',
  'Haryana': 'HARYANA',
  'Delhi': 'DELHI',
  'Jammu and Kashmir': 'JAMMU AND KASHMIR',
  'Uttarakhand': 'UTTARAKHAND',
  'Himachal Pradesh': 'HIMACHAL PRADESH',
  'Tripura': 'TRIPURA',
  'Meghalaya': 'MEGHALAYA',
  'Manipur': 'MANIPUR',
  'Nagaland': 'NAGALAND',
  'Goa': 'GOA',
  'Arunachal Pradesh': 'ARUNACHAL PRADESH',
  'Puducherry': 'PUDUCHERRY',
  'Mizoram': 'MIZORAM',
  'Chandigarh': 'CHANDIGARH',
  'Sikkim': 'SIKKIM',
  'Andaman and Nicobar Islands': 'ANDAMAN AND NICOBAR ISLANDS',
  'Dadra and Nagar Haveli and Daman and Diu': 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
  'Ladakh': 'LADAKH',
  'Lakshadweep': 'LAKSHADWEEP'
}

function normalizeStateName(stateName) {
  if (!stateName) return null
  
  // Try exact match
  if (stateNormalizationMap[stateName]) {
    return stateNormalizationMap[stateName]
  }
  
  // Try case-insensitive match
  const matchingKey = Object.keys(stateNormalizationMap).find(
    key => key.toLowerCase() === stateName.toLowerCase()
  )
  
  if (matchingKey) {
    return stateNormalizationMap[matchingKey]
  }
  
  // Default: convert to uppercase
  return stateName.toUpperCase()
}

async function getLocationFromIP(ip) {
  // Try ipapi.co first (more accurate for India)
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        'User-Agent': 'MGNREGA-Visualizer/1.0'
      },
      signal: AbortSignal.timeout(5000)
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.country_code === 'IN') {
        return {
          state: normalizeStateName(data.region),
          stateRaw: data.region,
          district: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
          source: 'ipapi.co'
        }
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // Fallback to ip-api.com
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon`, {
      signal: AbortSignal.timeout(5000)
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.status === 'success' && data.country === 'India') {
        return {
          state: normalizeStateName(data.regionName),
          stateRaw: data.regionName,
          district: data.city,
          latitude: data.lat,
          longitude: data.lon,
          source: 'ip-api.com'
        }
      }
    }
  } catch (err) {
    throw new Error('IP geolocation failed')
  }

  return null
}

function getUserIP(req) {
  // Check common headers for real IP (in case behind proxy/CDN)
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIP = req.headers['x-real-ip']
  if (realIP) {
    return realIP
  }
  
  // For local development, use a test IP
  const remoteAddr = req.socket.remoteAddress
  if (remoteAddr === '::1' || remoteAddr === '127.0.0.1') {
    // Use a real Indian IP for testing (this is a public IP from Lucknow)
    return '103.120.164.1'
  }
  
  return remoteAddr
}

module.exports = async function handler(req, res) {
  try {
    const userIP = getUserIP(req)
    const cacheKey = `ip-location:${userIP}`
    
    // Check cache first (cache for 24 hours since IP location doesn't change often)
    const cached = getCached(cacheKey)
    if (cached) {
      return res.status(200).json({ fromCache: true, ip: userIP, ...cached })
    }
    
    // Get location from IP
    const location = await getLocationFromIP(userIP)
    
    if (location) {
      // Cache the result
      setCached(cacheKey, location, 60 * 60 * 24) // 24 hours
      
      return res.status(200).json({
        fromCache: false,
        ip: userIP,
        ...location
      })
    }
    
    // No location found
    return res.status(404).json({
      error: 'Unable to determine location from IP',
      ip: userIP
    })
    
  } catch (error) {
    console.error('IP location error:', error)
    return res.status(500).json({
      error: 'Failed to get IP location',
      message: error.message
    })
  }
}
