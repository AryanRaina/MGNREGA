// API endpoint to fetch districts for a given state
const https = require('https')
const { getCached, setCached } = require('../../server/cache')

module.exports = async function handler(req, res){
  const { state } = req.query
  
  if(!state){
    return res.status(400).json({ error: 'state parameter required' })
  }

  if(!process.env.DATA_GOV_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  const stateUpper = state.toUpperCase()
  const cacheKey = `districts:${stateUpper}`
  
  // Check cache first (cache for 24 hours since districts don't change)
  const cached = getCached(cacheKey)
  if (cached) {
    return res.status(200).json({ ...cached, fromCache: true })
  }

  const apiUrl = `https://api.data.gov.in/resource/ee03643a-ee4c-48c2-ac30-9f2ff26ab722?api-key=${process.env.DATA_GOV_API_KEY}&format=json&limit=1000&filters[state_name]=${encodeURIComponent(stateUpper)}`

  return new Promise((resolve) => {
    const request = https.get(apiUrl, (response) => {
      let data = ''
      
      response.on('data', (chunk) => {
        data += chunk
      })
      
      response.on('end', () => {
        try {
          const json = JSON.parse(data)
          
          if(!json.records || !Array.isArray(json.records)) {
            const emptyResult = { districts: [], count: 0 }
            res.status(200).json(emptyResult)
            return resolve()
          }

          // Extract unique district names and sort them
          const districts = [...new Set(json.records.map(r => r.district_name))]
            .filter(Boolean)
            .sort()
          
          const result = { districts, count: districts.length }
          
          // Cache for 24 hours
          setCached(cacheKey, result, 60 * 60 * 24)
          
          res.status(200).json({ ...result, fromCache: false })
          resolve()
        } catch (e) {
          console.error('Failed to parse API response:', e.message)
          res.status(500).json({ error: 'Failed to parse API response', districts: [] })
          resolve()
        }
      })
    })
    
    request.on('error', (err) => {
      console.error('API request failed:', err.message)
      res.status(500).json({ error: 'Failed to fetch districts', districts: [] })
      resolve()
    })
    
    // Add timeout to prevent hanging requests
    request.setTimeout(15000, () => {
      request.destroy()
      console.error('API request timeout for state:', stateUpper)
      res.status(504).json({ error: 'Request timeout', districts: [] })
      resolve()
    })
  })
}
