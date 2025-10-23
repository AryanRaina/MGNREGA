const fs = require('fs')
const path = require('path')

const cacheDir = path.join(process.cwd(), 'data', 'cache')
if(!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

function keyToFile(key){
  const safe = Buffer.from(key).toString('base64').replace(/=/g,'')
  return path.join(cacheDir, safe + '.json')
}

function setCached(key, value, ttlSeconds=3600){
  const file = keyToFile(key)
  const payload = { value, expires_at: Math.floor(Date.now()/1000) + ttlSeconds, stored_at: Date.now() }
  fs.writeFileSync(file, JSON.stringify(payload))
}

function getCached(key, opts={ allowStale: false }){
  const file = keyToFile(key)
  if(!fs.existsSync(file)) return null
  try{
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw)
    const now = Math.floor(Date.now()/1000)
    if(parsed.expires_at >= now) return parsed.value
    if(opts.allowStale) return parsed.value
    return null
  }catch(e){
    return null
  }
}

module.exports = { setCached, getCached }
