# MGNREGA API Integration Guide

## Current Status: Using Sample Data ⚠️

This application currently uses **sample/offline data** because **data.gov.in does not provide a real-time MGNREGA API endpoint**.

### What We Discovered

1. **data.gov.in** provides MGNREGA data as:
   - Static CSV/JSON/XML file downloads
   - Historical datasets (updated periodically)
   - Not real-time API access

2. The endpoint `https://data.gov.in/api/mgnrega` **does not exist**
   - Returns HTML 404 page instead of JSON
   - No documented API for MGNREGA data

## Options for Real Data Integration

### Option 1: Official MGNREGA Portal (nrega.nic.in)
The official source for MGNREGA data is **nrega.nic.in**

**Pros:**
- Most accurate and up-to-date data
- Official government source

**Cons:**
- No public API available
- Would require web scraping (may violate terms of service)
- Data structure may change without notice

### Option 2: Download Static Data from data.gov.in
You can download MGNREGA datasets manually:
1. Visit https://data.gov.in
2. Search for "MGNREGA"
3. Download CSV/JSON files
4. Update `data/sample-mgnrega.json` with real data

**Pros:**
- Legal and official
- Reliable data structure

**Cons:**
- Manual process
- Data becomes stale over time
- No automation

### Option 3: Build a Data Pipeline
Create your own data collection system:
1. Periodically download data from official sources
2. Process and normalize the data
3. Store in a database
4. Serve via your own API

**Pros:**
- Full control over data freshness
- Can combine multiple sources
- Custom data transformations

**Cons:**
- Requires infrastructure
- Ongoing maintenance
- Server costs

### Option 4: Third-Party API Services
Check if any third-party services provide MGNREGA data APIs:
- Private data aggregators
- Government data platforms
- Research institutions

## How to Integrate a Real API (When Available)

### Step 1: Update the API Key
If you get access to a real MGNREGA API, update `.env.local`:

```bash
# Replace with your actual API key
DATA_GOV_API_KEY=your_real_api_key_here

# Add the API endpoint if different
MGNREGA_API_ENDPOINT=https://your-api-endpoint.com/mgnrega
```

### Step 2: Update the Fetch Function
In `pages/api/mgnrega.js`, uncomment and modify the `fetchFromGov` function:

```javascript
async function fetchFromGov(state, district, month){
  if(!process.env.DATA_GOV_API_KEY) return null
  
  // Update this URL to match your API endpoint
  const apiEndpoint = process.env.MGNREGA_API_ENDPOINT || 'https://api.example.com/mgnrega'
  
  const params = new URLSearchParams({
    state,
    district
  })
  if(month) params.set('month', month)
  params.set('api-key', process.env.DATA_GOV_API_KEY)

  const upstreamUrl = `${apiEndpoint}?${params.toString()}`
  
  try {
    const response = await fetch(upstreamUrl, {
      headers: { 'Accept': 'application/json' }
    })
    
    if(!response.ok) throw new Error(`API returned ${response.status}`)
    
    const data = await response.json()
    return normalizeUpstream(data)
  } catch(err) {
    console.error('API fetch failed:', err)
    throw err
  }
}
```

### Step 3: Update the Data Normalizer
Modify the `normalizeUpstream` function to match your API's response format:

```javascript
function normalizeUpstream(payload){
  // Adjust this based on your API's structure
  return {
    latest: {
      total_workers: payload.data?.workers || 0,
      total_jobs: payload.data?.jobs || 0,
      // ... map other fields
    },
    trend: (payload.trend || []).map(item => ({
      month: item.date,
      total_workers: item.workers,
      // ... map other fields
    })),
    stateAverage: payload.stateStats || null,
    comparison: payload.comparison || null,
    source: 'upstream'
  }
}
```

### Step 4: Test the Integration
```bash
# Start the server
npm run dev

# Test the API endpoint
curl "http://localhost:3001/api/mgnrega?state=Uttar+Pradesh&district=Agra"
```

Check the console logs for:
- ✅ Successfully fetched data from API
- 📊 Using API data (upstream)

## Current Architecture

```
User Request
    ↓
Next.js API Route (/api/mgnrega)
    ↓
Try Real API (currently returns null)
    ↓
Fallback to Sample Data (data/sample-mgnrega.json)
    ↓
Cache Result (1 hour)
    ↓
Return to Frontend
```

## Sample Data Structure

The sample data in `data/sample-mgnrega.json` follows this structure:

```json
{
  "Uttar Pradesh": {
    "Agra": {
      "latest": {
        "total_workers": 146200,
        "total_jobs": 69420,
        "total_expenditure": 52.8,
        "women_share": 0.48,
        "average_wage": 252,
        "average_days_worked": 47,
        "households_worked": 86500
      },
      "trend": [
        {
          "month": "2025-04",
          "total_workers": 132000,
          // ... other fields
        }
      ]
    }
  }
}
```

## Questions?

For questions about integrating a real API or updating the data source, contact your development team or raise an issue in the project repository.
