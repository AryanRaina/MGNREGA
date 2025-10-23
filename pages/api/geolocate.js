const { getCached, setCached } = require('../../server/cache')
const upDistricts = require('../../data/up-districts.json')

// State name normalization (same as ip-location.js)
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

function normalise(value=''){
  return value.toLowerCase().replace(/district/g, '').replace(/\s+/g, '').trim()
}

// Cache for district lists to avoid repeated API calls
const districtCache = new Map()
const DISTRICT_CACHE_TTL = 60 * 60 * 1000 // 1 hour in milliseconds

// Fetch districts dynamically from the API based on state
async function fetchDistrictsForState(stateName) {
  if (!stateName) return []
  
  // For UP, use local data for faster response
  if (stateName === 'UTTAR PRADESH') {
    return upDistricts
  }
  
  // Check in-memory cache first
  const cacheKey = `districts:${stateName}`
  const cached = districtCache.get(cacheKey)
  if (cached && (Date.now() - cached.timestamp < DISTRICT_CACHE_TTL)) {
    return cached.data
  }
  
  try {
    const apiKey = process.env.DATA_GOV_API_KEY || '579b464db66ec23bdd000001da8a7abfbcd64f504fc56a39d974f160'
    const apiUrl = new URL('https://api.data.gov.in/resource/ee03643a-ee4c-48c2-ac30-9f2ff26ab722')
    apiUrl.searchParams.set('api-key', apiKey)
    apiUrl.searchParams.set('format', 'json')
    apiUrl.searchParams.set('limit', '1000')
    apiUrl.searchParams.set('filters[state_name]', stateName)
    
    const response = await fetch(apiUrl.toString(), {
      signal: AbortSignal.timeout(15000) // Increased to 15 seconds
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.records && Array.isArray(data.records)) {
        const districts = [...new Set(data.records.map(r => r.district_name).filter(Boolean))]
        const sortedDistricts = districts.sort()
        
        // Cache the result
        districtCache.set(cacheKey, {
          data: sortedDistricts,
          timestamp: Date.now()
        })
        
        return sortedDistricts
      }
    }
  } catch (err) {
    // Only log non-timeout errors if we don't have cached data
    if (!districtCache.has(cacheKey)) {
      console.error('Failed to fetch districts for state:', stateName, err.name || err.message)
    }
    
    // Return stale cache if available
    const staleCache = districtCache.get(cacheKey)
    if (staleCache) {
      return staleCache.data
    }
  }
  
  return []
}

async function findDistrictName(possibleNames, stateName = 'UTTAR PRADESH'){
  // Fetch districts for the detected state
  const districts = await fetchDistrictsForState(stateName)
  
  if (districts.length === 0) {
    return null
  }
  
  const districtMap = districts.reduce((acc, name) => {
    acc[normalise(name)] = name
    return acc
  }, {})
  
  for(const name of possibleNames){
    if(!name) continue
    const key = normalise(name)
    if(districtMap[key]) return districtMap[key]
    
    // Try partial matching for cities/districts
    for(const [mapKey, mapName] of Object.entries(districtMap)) {
      if(key.includes(mapKey) || mapKey.includes(key)) {
        return mapName
      }
    }
  }
  return null
}

async function reverseGeocode(lat, lon) {
  const reverseUrl = new URL('https://nominatim.openstreetmap.org/reverse')
  reverseUrl.searchParams.set('format', 'jsonv2')
  reverseUrl.searchParams.set('lat', lat)
  reverseUrl.searchParams.set('lon', lon)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  
  try {
    const response = await fetch(reverseUrl.toString(), {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MGNREGA-Visualizer/0.1 (+https://github.com/your-org)'
      }
    })
    clearTimeout(timeout)
    
    if(!response.ok) throw new Error('reverse geocode failed')
    const payload = await response.json()
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

module.exports = async function handler(req, res){
  const { lat, lon, method = 'gps' } = req.query
  
  if(!lat || !lon){
    res.status(400).json({ error: 'lat and lon are required' })
    return
  }

  const cacheKey = `geolocate:${method}:${lat}:${lon}`
  const cached = getCached(cacheKey)
  if(cached){
    res.status(200).json({ fromCache: true, method, ...cached })
    return
  }

  try {
    const payload = await reverseGeocode(lat, lon)
    const address = payload.address || {}
    
    // Normalize state name
    const stateName = normalizeStateName(address.state)
    
    // Find district based on the detected state
    const districtName = await findDistrictName([
      address.state_district,
      address.county,
      address.district,
      address.city,
      address.town,
      address.city_district
    ], stateName)
    
    const result = {
      district: districtName,
      state: stateName,
      stateRaw: address.state,
      method,
      address: {
        display: payload.display_name,
        components: address
      }
    }
    
    if(districtName){
      // Cache for 30 minutes for GPS, 6 hours for IP-based
      const ttl = method === 'ip' ? 60 * 60 * 6 : 60 * 30
      setCached(cacheKey, result, ttl)
    }
    
    res.status(200).json(result)
  } catch(error) {
    const stale = getCached(cacheKey, { allowStale: true })
    if(stale){
      res.status(200).json({ ...stale, stale: true })
      return
    }
    res.status(502).json({ error: 'unable to detect district', method })
  }
}
