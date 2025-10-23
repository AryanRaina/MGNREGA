import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import upDistricts from '../data/up-districts.json'
import statesList from '../data/states.json'
import stateLanguages from '../data/state-languages.json'
import regionalTranslations from '../data/translations.json'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const fetcher = (url) => fetch(url).then(r => r.json())
const numberFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

function formatWorkers(value){
  return Number.isFinite(value) ? numberFormatter.format(value) : '—'
}

function formatHouseholds(value){
  return Number.isFinite(value) ? numberFormatter.format(value) : '—'
}

function formatExpenditure(value){
  return Number.isFinite(value) ? `₹${value.toFixed(1)} Cr` : '—'
}

function formatDays(value){
  if(!Number.isFinite(value)) return '—'
  return value.toFixed(1)
}

function formatPercent(value){
  if(!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function formatShare(value){
  if(!Number.isFinite(value)) return '—'
  return `${Math.round(value * 100)}%`
}

function formatRupees(value){
  if(!Number.isFinite(value)) return '—'
  return `₹${Math.round(value)}`
}

function LargeButton({ children, onClick, disabled }){
  return <button className="large-btn" onClick={onClick} disabled={disabled}>{children}</button>
}

function MetricCard({ icon, title, subtitle, value, helper }){
  return (
    <div className="card" role="group" aria-label={`${title} ${subtitle}`}>
      <div className="card-title">{icon} {title}</div>
      <div className="card-subtitle">{subtitle}</div>
      <div className="card-value">{value}</div>
      {helper ? <div className="card-helper">{helper}</div> : null}
    </div>
  )
}

function InfoPanel({ title, children }){
  return (
    <section className="panel">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export default function Home(){
  const [state, setState] = useState('') // Start empty, will be set by IP detection
  const [district, setDistrict] = useState('')
  const [districts, setDistricts] = useState([])
  
  // Initialize language - always start with 'hi' to match server render
  const [language, setLanguage] = useState('hi')
  
  // Track window size for responsive chart
  const [isMobile, setIsMobile] = useState(false)
  
  // Load saved language preference after mount (client-side only)
  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem('mgnrega-language')
      if (savedLanguage) {
        // Support all saved languages (hi, en, ta, te, kn, ml, etc.)
        setLanguage(savedLanguage)
      }
    } catch (err) {
      console.error('Failed to load language preference:', err)
    }
  }, [])
  
  // Handle window resize for responsive chart
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    // Check on mount
    checkMobile()
    
    // Add resize listener
    window.addEventListener('resize', checkMobile)
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  const [hint, setHint] = useState('📍 आपकी लोकेशन से जिला पहचानने की कोशिश हो रही है…')
  const [locationError, setLocationError] = useState(null)
  const [detectedLocation, setDetectedLocation] = useState(null) // Store IP-detected location
  const [locationDetected, setLocationDetected] = useState(false) // Track if IP detection completed
  const [locationInfo, setLocationInfo] = useState(null) // Store location info for display
  const [suggestedLanguage, setSuggestedLanguage] = useState(null) // Regional language suggestion

  // Save language preference to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('mgnrega-language', language)
    } catch (err) {
      console.error('Failed to save language preference:', err)
    }
  }, [language])

  // Fetch districts when state changes
  const { data: districtData, error: districtError } = useSWR(
    state ? `/api/districts?state=${encodeURIComponent(state)}` : null,
    fetcher
  )

  // Update districts list when data is fetched
  useEffect(() => {
    if (districtData && districtData.districts && districtData.districts.length > 0) {
      setDistricts(districtData.districts)
      
      // If we have a detected location for this state, apply it
      if (detectedLocation && detectedLocation.state === state) {
        const detectedDistrict = detectedLocation.district
        console.log('✅ Applying detected location:', detectedDistrict, 'for state:', state)
        console.log('📋 Available districts:', districtData.districts.slice(0, 5), '...')
        
        // Check if detected district exists in the loaded list
        if (districtData.districts.includes(detectedDistrict)) {
          console.log('✅ District found in list, setting:', detectedDistrict)
          setDistrict(detectedDistrict)
          setLocationInfo({
            district: detectedDistrict,
            stateRaw: detectedLocation.stateRaw,
            source: detectedLocation.source
          })
          setLocationError(null)
          setDetectedLocation(null) // Clear after applying
        } else {
          // District not found in the list, use first available
          console.log('⚠️ District not found in list, using first:', districtData.districts[0])
          setDistrict(districtData.districts[0])
          const stateFormatted = state.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
          setLocationInfo({
            district: districtData.districts[0],
            stateRaw: stateFormatted,
            source: 'fallback'
          })
          setDetectedLocation(null)
        }
      } else if (!district || !districtData.districts.includes(district)) {
        // Set first district as default if current district is not in new list
        setDistrict(districtData.districts[0])
      }
    } else {
      // Fallback to UP districts if API fails
      if (state === 'UTTAR PRADESH') {
        setDistricts(upDistricts)
        if (!district) setDistrict(upDistricts[0])
      }
    }
  }, [districtData, state, detectedLocation])

  // Set initial district
  useEffect(() => {
    if (!district && districts.length > 0) {
      setDistrict(districts[0])
    }
  }, [districts])

  // Update hint when language changes
  useEffect(() => {
    if (locationInfo) {
      const { district: dist, stateRaw, source } = locationInfo
      if (language === 'hi') {
        if (source === 'cache') {
          setHint(`✅ आप ${dist}, ${stateRaw} में हैं (सहेजा हुआ स्थान)`)
        } else if (source === 'ip-direct' || source === 'ip-geocode') {
          setHint(`✅ आप ${dist}, ${stateRaw} में हैं (IP से पहचाना गया)`)
        } else if (source === 'gps') {
          setHint(`✅ आप ${dist}, ${stateRaw} में हैं (GPS से पहचाना गया)`)
        } else {
          setHint(`📍 ${dist}, ${stateRaw}`)
        }
      } else {
        if (source === 'cache') {
          setHint(`✅ You are in ${dist}, ${stateRaw} (cached location)`)
        } else if (source === 'ip-direct' || source === 'ip-geocode') {
          setHint(`✅ You are in ${dist}, ${stateRaw} (detected from IP)`)
        } else if (source === 'gps') {
          setHint(`✅ You are in ${dist}, ${stateRaw} (detected from GPS)`)
        } else {
          setHint(`📍 ${dist}, ${stateRaw}`)
        }
      }
    } else if (locationDetected) {
      // Just show loading message based on current language
      setHint(language === 'hi' ? '📍 जिला लोड हो रहा है...' : '📍 Loading district...')
    } else {
      // Initial loading message
      setHint(language === 'hi' ? '📍 आपकी लोकेशन से जिला पहचानने की कोशिश हो रही है…' : '📍 Detecting your location...')
    }
  }, [language, locationInfo, locationDetected])

  // Suggest regional language when state changes
  useEffect(() => {
    if (state) {
      console.log('🔍 Checking regional language for state:', state)
      const regionalLang = stateLanguages[state]
      console.log('📚 Found regional language:', regionalLang)
      
      if (regionalLang && regionalLang.code !== 'hi' && regionalLang.code !== 'en') {
        console.log('💬 Setting suggested language:', regionalLang.englishName, '(' + regionalLang.name + ')')
        setSuggestedLanguage(regionalLang)
      } else {
        console.log('❌ No regional language suggestion (Hindi/English state)')
        setSuggestedLanguage(null)
      }
    }
  }, [state, language])

  // Language content - merge base content with regional translations
  const content = {
    hi: {
      title: 'MGNREGA जिला रिपोर्ट',
      tagline: 'सरल भाषा · मोबाइल के लिए तैयार',
      selectState: 'राज्य चुनें',
      selectDistrict: 'अपना ज़िला चुनें',
      refresh: '🔄 ताज़ा करें',
      resetLocation: '📍 स्थान फिर से पहचानें',
      loading: '⏳ डेटा लोड हो रहा है…',
      loadingDistricts: '📍 जिले लोड हो रहे हैं...',
      error: '⚠️ डेटा नहीं मिला। कृपया थोड़ी देर बाद दोबारा देखें।',
      noData: '⚠️ इस जिले के लिए डेटा उपलब्ध नहीं है। कृपया दूसरा जिला चुनें।',
      source: 'स्रोत',
      workers: 'श्रमिक',
      workDays: 'काम के दिन',
      spend: 'खर्च',
      women: 'महिला हिस्सेदारी',
      avgWage: 'औसत मज़दूरी',
      households: 'परिवार',
      workersHelp: 'पिछले महीने काम पाने वाले लोग',
      workDaysHelp: 'रोज़गार के दिन (जॉब कार्ड)',
      spendHelp: 'कुल व्यय (₹ में करोड़)',
      womenHelp: 'काम करने वाली महिलाओं की भागीदारी',
      avgWageHelp: 'प्रति दिन औसत मज़दूरी',
      householdsHelp: 'काम पाए परिवार',
      rank: 'रैंक',
      chartTitle: 'श्रमिक रुझान',
      stateAvg: 'राज्य औसत',
      compareTitle: 'राज्य औसत से तुलना',
      infoTitle1: 'यह आंकड़े किस काम के हैं?',
      infoTitle2: 'बेहतर समझ के लिए सुझाव',
      footer: 'डेटा का स्रोत: data.gov.in (API) + ऑफ़लाइन बैकअप · कैश किया हुआ डेटा सर्वर पर सुरक्षित रखा जाता है।',
      geoLocating: '📍 आपकी लोकेशन से जिला पहचानने की कोशिश हो रही है…',
      geoFound: (lat, lon) => `📍 स्थान मिला • ${lat.toFixed(2)}, ${lon.toFixed(2)} • जिला खोज रहे हैं…`,
      geoSuccess: (dist) => `✅ आप ${dist} ज़िले में हैं`,
      geoNoDistrict: 'ℹ️ लोकेशन से जिला नहीं मिला, कृपया सूची से चुनें',
      geoError: '⚠️ जिला पहचानने में दिक्कत हुई, कृपया सूची से चुनें',
      geoPermission: 'ℹ️ GPS की अनुमति नहीं मिली, कृपया जिला सूची से चुनें',
      geoNotAvailable: '📍 लोकेशन सुविधा उपलब्ध नहीं है (GPS off)',
      // Comparison panel
      moreWorkers: 'अधिक श्रमिक राज्य औसत से',
      workDaysDiff: 'काम के दिन का अंतर',
      changeFrom: 'बदलाव अप्रैल 2025 से',
      stateExpShare: 'राज्य खर्च में आपका हिस्सा',
      // Trend summary
      increase: 'बढ़त',
      decrease: 'कमी',
      noChange: 'कोई बदलाव नहीं',
      trendFrom: 'से',
      trendTo: 'तक',
      workersChange: 'श्रमिकों का बदलाव',
      // Chart
      chartNoData: 'चार्ट के लिए पर्याप्त डेटा नहीं',
      // State average section
      stateAvgWorkers: 'राज्य औसत श्रमिक',
      avgDays: 'औसत दिन',
      avgWageState: 'औसत मज़दूरी',
      avgWorkersHelp: 'औसत श्रमिक',
      avgDaysHelp: 'प्रति घर औसत काम',
      avgWageStateHelp: 'राज्य औसत मज़दूरी',
      // Source labels
      sourceUpstream: 'data.gov.in',
      sourceOffline: 'ऑफ़लाइन पैक (कैश)',
      // Info panel details
      infoWorkers: 'कितने लोगों को रोज़गार मिला।',
      infoWorkDays: 'कुल काम के दिन, जिससे मजदूरी तय होती है।',
      infoSpend: 'सरकार का कुल खर्च, करोड़ रुपये में।',
      infoWomen: 'महिला मजदूरों की भागीदारी।',
      // Tips
      tipRefresh: 'हर हफ्ते ताज़ा आंकड़ों के लिए Refresh दबाएँ।',
      tipNetwork: 'नेटवर्क स्लो हो तो ऑफ़लाइन कैश से पुराना डेटा दिखेगा।',
      tipDistrict: 'अपना जिला गलत दिख रहा हो तो सूची से सही जिला चुनें।',
    },
    en: {
      title: 'MGNREGA District Report',
      tagline: 'Simple Language · Mobile Ready',
      selectState: 'Select State',
      selectDistrict: 'Choose your District',
      refresh: '🔄 Refresh',
      resetLocation: '📍 Detect Location Again',
      loading: '⏳ Loading data…',
      loadingDistricts: '📍 Loading districts...',
      error: '⚠️ Data not found. Please try again later.',
      noData: '⚠️ No data available for this district. Please select another district.',
      source: 'Source',
      workers: 'Workers',
      workDays: 'Work Days',
      spend: 'Spend',
      women: 'Women Share',
      avgWage: 'Average Wage',
      households: 'Households',
      workersHelp: 'People who got work last month',
      workDaysHelp: 'Employment days (job card)',
      spendHelp: 'Total expenditure (₹ in Crores)',
      womenHelp: 'Participation of women workers',
      avgWageHelp: 'Average wage per day',
      householdsHelp: 'Families who got work',
      rank: 'Rank',
      chartTitle: 'Worker Trend',
      stateAvg: 'State Average',
      compareTitle: 'Compare with State Average',
      infoTitle1: 'What are these figures for?',
      infoTitle2: 'Tips for better understanding',
      footer: 'Data source: data.gov.in (API) + Offline backup · Cached data is stored securely on the server.',
      geoLocating: '📍 Trying to identify district from your location…',
      geoFound: (lat, lon) => `📍 Location found • ${lat.toFixed(2)}, ${lon.toFixed(2)} • Searching district…`,
      geoSuccess: (dist) => `✅ You are in ${dist} district`,
      geoNoDistrict: 'ℹ️ District not found from location, please select from list',
      geoError: '⚠️ Problem identifying district, please select from list',
      geoPermission: 'ℹ️ GPS permission denied, please select district from list',
      geoNotAvailable: '📍 Location service not available (GPS off)',
      // Comparison panel
      moreWorkers: 'more workers than state average',
      workDaysDiff: 'work days difference',
      changeFrom: 'change since April 2025',
      stateExpShare: 'your share of state expenditure',
      // Trend summary
      increase: 'Increase',
      decrease: 'Decrease',
      noChange: 'No change',
      trendFrom: 'from',
      trendTo: 'to',
      workersChange: 'workers change',
      // Chart
      chartNoData: 'Not enough data for chart',
      // State average section
      stateAvgWorkers: 'State Average Workers',
      avgDays: 'Average Days',
      avgWageState: 'Average Wage',
      avgWorkersHelp: 'Average workers',
      avgDaysHelp: 'Average work per household',
      avgWageStateHelp: 'State average wage',
      // Source labels
      sourceUpstream: 'data.gov.in',
      sourceOffline: 'Offline pack (cached)',
      // Info panel details
      infoWorkers: 'How many people got employment.',
      infoWorkDays: 'Total work days, which determines wages.',
      infoSpend: 'Government\'s total expenditure in crores.',
      infoWomen: 'Participation of women workers.',
      // Tips
      tipRefresh: 'Press Refresh for fresh data every week.',
      tipNetwork: 'If network is slow, old data from offline cache will show.',
      tipDistrict: 'If your district is wrong, select the correct one from the list.',
    },
    // Add regional language translations
    ...regionalTranslations
  }

  // Get translations with fallback to Hindi if language not found
  const t = content[language] || content['hi']

  // Handler for state change - update cache
  const handleStateChange = (newState) => {
    setState(newState)
    // Don't cache state-only changes, wait for district to be set
    console.log('📍 State changed to:', newState)
  }

  // Handler for district change - update cache with manual flag
  const handleDistrictChange = (newDistrict) => {
    setDistrict(newDistrict)
    
    // Cache the manual selection with 7-day duration
    if (state && newDistrict) {
      try {
        // Find the raw state name for display
        const stateRaw = state.split(' ').map(word => 
          word.charAt(0) + word.slice(1).toLowerCase()
        ).join(' ')
        
        localStorage.setItem('mgnrega-location', JSON.stringify({
          state: state,
          stateRaw: stateRaw,
          district: newDistrict,
          source: 'manual', // Mark as manual selection
          timestamp: Date.now()
        }))
        console.log('💾 Manual selection cached (7 days):', newDistrict, state)
      } catch (err) {
        console.error('Failed to cache manual selection:', err)
      }
    }
  }

  // Handler to reset cached location and re-detect
  const handleResetLocation = () => {
    try {
      localStorage.removeItem('mgnrega-location')
      console.log('🗑️ Cached location cleared, reloading page...')
      window.location.reload()
    } catch (err) {
      console.error('Failed to reset location:', err)
    }
  }

  useEffect(() => {
    // Only run once on mount
    if (locationDetected) return
    
    // Location Detection & Caching System:
    // 1. Always check IP on page load to detect if user moved
    // 2. Use cached location for instant display while verifying
    // 3. Update if IP location differs from cache
    // 4. Cache duration: 24 hours (re-checks daily)
    // 5. User can reset cache with 🔄 button to force re-detection
    
    async function detectLocation() {
      let usedCache = false
      
      // Check cache first for instant display (non-blocking)
      try {
        const cachedLocation = localStorage.getItem('mgnrega-location')
        if (cachedLocation) {
          const cached = JSON.parse(cachedLocation)
          const cacheAge = Date.now() - cached.timestamp
          const CACHE_DURATION_AUTO = 24 * 60 * 60 * 1000 // 24 hours for auto-detected
          const CACHE_DURATION_MANUAL = 7 * 24 * 60 * 60 * 1000 // 7 days for manual
          
          const cacheDuration = cached.source === 'manual' ? CACHE_DURATION_MANUAL : CACHE_DURATION_AUTO
          
          // Use cache for instant display if recent
          if (cacheAge < cacheDuration) {
            console.log('⚡ Quick load from cache:', cached.district, cached.state, '(source:', cached.source + ')')
            setState(cached.state)
            setLocationDetected(true)
            setDetectedLocation({
              state: cached.state,
              stateRaw: cached.stateRaw,
              district: cached.district,
              source: cached.source
            })
            setLocationInfo({
              district: cached.district,
              stateRaw: cached.stateRaw,
              source: cached.source
            })
            usedCache = true
            
            // If manual selection, skip IP verification (user explicitly chose this location)
            if (cached.source === 'manual') {
              console.log('✅ Manual selection - skipping IP verification')
              return
            }
            // Continue to verify IP in background for auto-detected locations
          } else {
            console.log('⏰ Cache expired, fetching fresh location')
            localStorage.removeItem('mgnrega-location')
          }
        }
      } catch (err) {
        console.error('Error reading cache:', err)
      }
      
      setHint(t.geoLocating)
      
      // Always check IP to verify/update location
      try {
        const ipResponse = await fetch('/api/ip-location')
        if (ipResponse.ok) {
          const ipData = await ipResponse.json()
          
          if (ipData.state) {
            console.log('📍 IP Detection - State:', ipData.state, 'District:', ipData.district)
            
            // Check if location changed from cache
            if (usedCache) {
              const cachedLocation = JSON.parse(localStorage.getItem('mgnrega-location'))
              if (cachedLocation && 
                  (cachedLocation.state !== ipData.state || cachedLocation.district !== ipData.district)) {
                console.log('🔄 Location changed! Old:', cachedLocation.district, '→ New:', ipData.district)
                // Location changed - update immediately
              } else if (cachedLocation && cachedLocation.state === ipData.state && cachedLocation.district === ipData.district) {
                console.log('✅ IP verification passed - location unchanged')
                return // Location verified, keep using cache
              }
            }
            
            // Set state automatically from IP
            setState(ipData.state)
            setLocationDetected(true)
            setHint(`📍 ${ipData.stateRaw || ipData.state}`)
            
            // Suggest regional language based on state
            const regionalLang = stateLanguages[ipData.state]
            if (regionalLang && regionalLang.code !== 'hi' && regionalLang.code !== 'en') {
              setSuggestedLanguage(regionalLang)
              console.log('💬 Suggested language:', regionalLang.englishName, '(' + regionalLang.name + ')')
            }
            
            // Store detected district to apply after districts load
            if (ipData.district) {
              console.log('💾 Storing detected location:', ipData.district, 'for state:', ipData.state)
              const locationData = {
                state: ipData.state,
                stateRaw: ipData.stateRaw,
                district: ipData.district,
                source: 'ip-direct'
              }
              setDetectedLocation(locationData)
              
              // Cache to localStorage
              try {
                localStorage.setItem('mgnrega-location', JSON.stringify({
                  ...locationData,
                  timestamp: Date.now()
                }))
                console.log('💾 Location cached to localStorage')
              } catch (err) {
                console.error('Failed to cache location:', err)
              }
              
              return // Success! No need to try GPS
            } else if (ipData.latitude && ipData.longitude) {
              // Try reverse geocoding to get district
              try {
                const geoResponse = await fetch(`/api/geolocate?lat=${ipData.latitude}&lon=${ipData.longitude}&method=ip`)
                const geoData = await geoResponse.json()
                
                if (geoData?.district) {
                  console.log('💾 Storing geocoded location:', geoData.district, 'for state:', ipData.state)
                  const locationData = {
                    state: ipData.state,
                    stateRaw: ipData.stateRaw,
                    district: geoData.district,
                    source: 'ip-geocode'
                  }
                  setDetectedLocation(locationData)
                  
                  // Cache to localStorage
                  try {
                    localStorage.setItem('mgnrega-location', JSON.stringify({
                      ...locationData,
                      timestamp: Date.now()
                    }))
                    console.log('💾 Geocoded location cached to localStorage')
                  } catch (err) {
                    console.error('Failed to cache location:', err)
                  }
                  
                  return
                }
              } catch (err) {
                // State is set, just no district
                setHint(`📍 ${ipData.stateRaw}`)
                return
              }
            }
            return // State is set, we're done
          }
        }
      } catch (err) {
        console.error('IP location failed:', err)
      }
      
      // IP detection failed - fallback to default (Uttar Pradesh)
      console.log('⚠️ IP detection failed, using default: UTTAR PRADESH')
      setState('UTTAR PRADESH')
      setDistricts(upDistricts)
      setLocationDetected(true)
      setHint('📍 Uttar Pradesh')
      
      // Optional: Try GPS as additional fallback
      if (navigator.geolocation) {
        setHint(t.geoLocating)
        
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords
            setHint(t.geoFound(latitude, longitude))
            
            try {
              const resp = await fetch(`/api/geolocate?lat=${latitude}&lon=${longitude}&method=gps`)
              const geo = await resp.json()
              
              if (geo?.state && geo?.district) {
                console.log('📍 GPS detected:', geo.district, geo.state)
                setState(geo.state)
                setDetectedLocation({
                  state: geo.state,
                  stateRaw: geo.stateRaw,
                  district: geo.district,
                  source: 'gps'
                })
                setLocationInfo({
                  district: geo.district,
                  stateRaw: geo.stateRaw,
                  source: 'gps'
                })
                setLocationError(null)
              } else {
                setHint(t.geoNoDistrict)
              }
            } catch (err) {
              setHint(t.geoError)
              setLocationError('Unable to auto detect district')
            }
          },
          () => {
            setHint(t.geoPermission)
            setLocationError('Location permission denied')
          },
          {
            timeout: 10000,
            maximumAge: 600000 // Cache position for 10 minutes
          }
        )
      }
    }
    
    detectLocation()
  }, []) // Only run once on mount

  const { data, error, isValidating, mutate } = useSWR(
    district && state ? `/api/mgnrega?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}&lastMonths=12` : null,
    fetcher,
    {
      revalidateOnFocus: false
    }
  )

  const chartData = useMemo(() => {
    if(!data?.trend?.length) return null
    const labels = data.trend.map(item => item.month)
    return {
      labels,
      datasets: [
        {
          label: t.workers,
          data: data.trend.map(item => item.total_workers),
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13, 110, 253, 0.1)',
          pointRadius: 4,
          tension: 0.3
        },
        data.stateAverage?.trend ? {
          label: t.stateAvg,
          data: data.stateAverage.trend.map(item => item.total_workers),
          borderColor: '#6c757d',
          borderDash: [6, 6],
          pointRadius: 3,
          tension: 0.3
        } : null
      ].filter(Boolean)
    }
  }, [data, language])

  const trendSummary = useMemo(() => {
    if(!data?.trend?.length) return null
    const first = data.trend[0]
    const last = data.trend[data.trend.length - 1]
    if(!first || !last) return null
    const change = last.total_workers - first.total_workers
    const changeLabel = change > 0 ? t.increase : change < 0 ? t.decrease : t.noChange
    return {
      changeLabel,
      changeValue: formatWorkers(Math.abs(change)),
      firstMonth: first.month,
      lastMonth: last.month
    }
  }, [data, language])

  return (
    <div className="container">
      <header>
        <h1>{t.title}</h1>
        <p className="tagline">{t.tagline}</p>
        <div className="language-toggle">
          <button 
            className={`lang-btn ${language === 'hi' ? 'active' : ''}`}
            onClick={() => setLanguage('hi')}
            aria-label="Switch to Hindi"
          >
            🇮🇳 हिंदी
          </button>
          <button 
            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
            aria-label="Switch to English"
          >
            🌐 English
          </button>
          {suggestedLanguage && (
            <button 
              className={`lang-btn regional ${language === suggestedLanguage.code ? 'active' : ''}`}
              onClick={() => {
                console.log('🗣️ Switching to regional language:', suggestedLanguage.code)
                setLanguage(suggestedLanguage.code)
              }}
              aria-label={`Switch to ${suggestedLanguage.englishName}`}
              title={`Switch to ${suggestedLanguage.englishName}`}
              style={language === suggestedLanguage.code ? {} : {
                animation: 'pulse 2s ease-in-out infinite',
                boxShadow: '0 0 10px rgba(255, 193, 7, 0.5)'
              }}
            >
              🗣️ {suggestedLanguage.name}
            </button>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <p className="hint" aria-live="polite" style={{ margin: 0 }}>{hint}</p>
        {detectedLocation?.source === 'cache' && (
          <button 
            onClick={handleResetLocation}
            style={{ 
              fontSize: '0.8rem', 
              padding: '0.25rem 0.5rem',
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            title={t.resetLocation}
          >
            🔄
          </button>
        )}
      </div>

      <div className="controls" role="group" aria-label="State and District selector">
        <div className="control-row">
          <div className="control-group">
            <label className="label" htmlFor="state-select">{t.selectState}</label>
            <select 
              id="state-select" 
              value={state} 
              onChange={e => handleStateChange(e.target.value)} 
              className="state-select"
            >
              {statesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          <div className="control-group">
            <label className="label" htmlFor="district-select">{t.selectDistrict}</label>
            <select 
              id="district-select" 
              value={district} 
              onChange={e => handleDistrictChange(e.target.value)} 
              className="district-select"
              disabled={!districts.length || districtData === undefined}
            >
              {districts.length === 0 && <option value="">{t.loadingDistricts}</option>}
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          
          <LargeButton onClick={() => mutate()} disabled={isValidating || !district}>{t.refresh}</LargeButton>
        </div>
      </div>

      {locationError && <p className="warn">{locationError}</p>}

      <div className="content" aria-live="polite">
        {error && <div className="error">{t.error}</div>}
        {!data && !error && district && <div className="loading">{t.loading}</div>}
        {!district && <div className="loading">{t.loadingDistricts}</div>}
        {data && !data.latest && <div className="error">{t.noData}</div>}

        {data && data.latest && (
          <div className="dashboard">
            <div className="section-header">
              <h2>{district} · {state}</h2>
              <span className="source-chip">
                {t.source}: {
                  data.stale ? '🕒 ' + t.sourceOffline + ' (Stale)' :
                  data.fromCache ? '📦 ' + (data.source === 'upstream' ? t.sourceUpstream : t.sourceOffline) + ' (Cached)' :
                  data.source === 'upstream' ? '✅ ' + t.sourceUpstream :
                  t.sourceOffline
                }
              </span>
            </div>

            <div className="cards">
              <MetricCard icon="👥" title={t.workers} subtitle="" value={formatWorkers(data.latest.total_workers)} helper={t.workersHelp} />
              <MetricCard icon="🧱" title={t.workDays} subtitle="" value={formatWorkers(data.latest.total_jobs)} helper={t.workDaysHelp} />
              <MetricCard icon="💰" title={t.spend} subtitle="" value={formatExpenditure(data.latest.total_expenditure)} helper={t.spendHelp} />
              <MetricCard icon="👩" title={t.women} subtitle="" value={formatShare(data.latest.women_share)} helper={t.womenHelp} />
              <MetricCard icon="🎯" title={t.avgWage} subtitle="" value={formatRupees(data.latest.average_wage)} helper={t.avgWageHelp} />
              <MetricCard icon="🏠" title={t.households} subtitle="" value={formatHouseholds(data.latest.households_worked)} helper={t.householdsHelp} />
            </div>

            {data.comparison && (
              <div className="comparison-panel">
                <div className="comparison-badge">🏅 {t.rank} {data.comparison.rankByWorkers} / {data.comparison.totalDistricts}</div>
                <div className="comparison-grid">
                  <div><strong>{formatPercent(data.comparison.workerDeltaPct)}</strong> {t.moreWorkers}</div>
                  <div><strong>{formatPercent(data.comparison.jobDeltaPct)}</strong> {t.workDaysDiff}</div>
                  <div><strong>{formatPercent(data.comparison.momentumPct)}</strong> {t.changeFrom}</div>
                  <div><strong>{formatPercent(data.comparison.expenditureSharePct)}</strong> {t.stateExpShare}</div>
                </div>
              </div>
            )}

            <div className="info-grid">
              <InfoPanel title={t.infoTitle1}>
                <ul>
                  <li>👥 <strong>{t.workers}</strong>: {t.infoWorkers}</li>
                  <li>🧱 <strong>{t.workDays}</strong>: {t.infoWorkDays}</li>
                  <li>💰 <strong>{t.spend}</strong>: {t.infoSpend}</li>
                  <li>👩 <strong>{t.women}</strong>: {t.infoWomen}</li>
                </ul>
              </InfoPanel>

              <InfoPanel title={t.infoTitle2}>
                <ul>
                  <li>🔁 {t.tipRefresh}</li>
                  <li>📶 {t.tipNetwork}</li>
                  <li>📍 {t.tipDistrict}</li>
                </ul>
              </InfoPanel>
            </div>

            <div className="chart" role="img" aria-label="MGNREGA trend chart">
              {chartData ? <Line data={chartData} options={{
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: isMobile ? 0.75 : 2,
                plugins: {
                  legend: { 
                    position: 'top',
                    labels: {
                      padding: isMobile ? 10 : 15,
                      font: {
                        size: isMobile ? 11 : 12
                      },
                      boxWidth: isMobile ? 30 : 40
                    }
                  },
                  title: { 
                    display: true, 
                    text: t.chartTitle,
                    font: {
                      size: isMobile ? 14 : 16,
                      weight: 'bold'
                    },
                    padding: {
                      top: 8,
                      bottom: isMobile ? 12 : 20
                    }
                  }
                },
                scales: {
                  x: {
                    ticks: {
                      font: {
                        size: isMobile ? 10 : 11
                      },
                      maxRotation: 0,
                      minRotation: 0,
                      autoSkip: true,
                      maxTicksLimit: isMobile ? 8 : 12
                    }
                  },
                  y: {
                    ticks: {
                      font: {
                        size: isMobile ? 10 : 11
                      },
                      maxTicksLimit: isMobile ? 8 : 10,
                      callback: value => {
                        if (isMobile) {
                          // Shorter format on mobile
                          if (value >= 100000) return (value / 100000).toFixed(0) + 'L'
                          if (value >= 1000) return (value / 1000).toFixed(0) + 'K'
                          return value
                        }
                        return numberFormatter.format(value)
                      }
                    }
                  }
                },
                interaction: {
                  mode: 'index',
                  intersect: false
                }
              }} /> : <p>{t.chartNoData}</p>}
            </div>

            {trendSummary && (
              <div className="trend-callout">
                <strong>{trendSummary.changeLabel}</strong> · {trendSummary.firstMonth} {t.trendFrom} {trendSummary.lastMonth} {t.trendTo} {trendSummary.changeValue} {t.workersChange}
              </div>
            )}

            {data.stateAverage && (
              <section className="state-panel">
                <h3>{t.compareTitle}</h3>
                <div className="state-cards">
                  <MetricCard icon="📊" title={t.stateAvgWorkers} subtitle="" value={formatWorkers(data.stateAverage.latest.total_workers)} helper={t.avgWorkersHelp} />
                  <MetricCard icon="⏱️" title={t.avgDays} subtitle="" value={formatDays(data.stateAverage.latest.average_days_worked)} helper={t.avgDaysHelp} />
                  <MetricCard icon="💵" title={t.avgWageState} subtitle="" value={formatRupees(data.stateAverage.latest.average_wage)} helper={t.avgWageStateHelp} />
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <footer>
        <small>{t.footer}</small>
      </footer>
    </div>
  )
}
