# IP-Based Auto Location Feature

## Overview
The application now automatically detects the user's state and district based on their IP address when the page loads. This provides a seamless experience without requiring manual location selection or GPS permissions.

## How It Works

### 1. IP Location Detection (`/api/ip-location`)
- **Primary Service**: Uses ipapi.co (free tier: 1000 requests/day)
- **Fallback Service**: Uses ip-api.com if primary fails
- **Detection Process**:
  1. Extracts user's IP from request headers
  2. Calls geolocation API to get state and city
  3. Normalizes state name to uppercase format (e.g., "Uttar Pradesh" → "UTTAR PRADESH")
  4. Caches result for 24 hours per IP

### 2. State Normalization
- Maps 36 Indian states/UTs to the format expected by data.gov.in API
- Handles variations like:
  - "Uttar Pradesh" → "UTTAR PRADESH"
  - "Tamil Nadu" → "TAMIL NADU"
  - "Jammu and Kashmir" → "JAMMU AND KASHMIR"

### 3. District Detection (`/api/geolocate`)
- Enhanced to work with all states (not just Uttar Pradesh)
- Dynamically fetches district list from data.gov.in API based on detected state
- Uses reverse geocoding (OpenStreetMap Nominatim) for GPS coordinates
- Matches detected city/district names against available MGNREGA districts
- Caches results: 6 hours for IP-based, 30 minutes for GPS-based

### 4. Frontend Auto-Selection (`pages/index.js`)
- **On Page Load**: Automatically calls `/api/ip-location`
- **Sets State**: Updates state dropdown to detected state
- **Sets District**: After districts load, sets to detected district
- **Fallback to GPS**: If IP detection fails, tries browser GPS (requires permission)
- **User Override**: Users can manually change state/district anytime

## User Experience

### Loading Sequence
1. **Page loads** → Shows: "📍 आपकी लोकेशन से जिला पहचानने की कोशिश हो रही है…"
2. **IP detected** → Shows: "📍 आपका स्थान IP से पहचाना गया • Maharashtra"
3. **District matched** → Shows: "✅ आप Mumbai, Maharashtra में हैं (IP से पहचाना गया)"
4. **Data loads** → Displays MGNREGA data for detected location

### Bilingual Messages
- **Hindi**: "आप Mumbai, Maharashtra में हैं (IP से पहचाना गया)"
- **English**: "You are in Mumbai, Maharashtra (detected from IP)"

### Edge Cases Handled
- ✅ User outside India → Falls back to GPS or manual selection
- ✅ IP service down → Tries fallback service, then GPS
- ✅ District not in MGNREGA data → Shows available districts for that state
- ✅ Local development → Uses test IP (103.120.164.1 - Lucknow)

## Technical Details

### API Endpoints Updated

#### `/api/ip-location`
```javascript
Response format:
{
  "state": "MAHARASHTRA",           // Normalized uppercase
  "stateRaw": "Maharashtra",        // Original from IP service
  "district": "Mumbai",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "source": "ipapi.co",
  "ip": "103.xxx.xxx.xxx",
  "fromCache": false
}
```

#### `/api/geolocate`
```javascript
Response format:
{
  "district": "Mumbai",
  "state": "MAHARASHTRA",           // Normalized
  "stateRaw": "Maharashtra",        // Original
  "method": "ip",
  "fromCache": false
}
```

### Caching Strategy
- **IP Location**: 24 hours (IPs rarely change)
- **GPS Geocode**: 30 minutes (users may move)
- **IP-based Geocode**: 6 hours (middle ground)
- **District Data**: 24 hours (static API data)

### Performance
- **First Load**: ~2-3 seconds (IP detection + API fetch)
- **Cached Load**: <500ms (all data from cache)
- **No User Interaction Required**: Zero-click auto-selection

## Testing

### Local Development
- Uses test IP: `103.120.164.1` (Lucknow, Uttar Pradesh)
- Can override by setting `X-Forwarded-For` header

### Production
- Detects real user IP from:
  1. `X-Forwarded-For` header (if behind proxy/CDN)
  2. `X-Real-IP` header
  3. `req.socket.remoteAddress` (direct connection)

## Future Enhancements
- [ ] Add more IP geolocation services for redundancy
- [ ] Improve district name matching with fuzzy search
- [ ] Add user preference storage (remember manual selection)
- [ ] Show "Detecting..." animation during location lookup
- [ ] Add option to disable auto-detection in settings

## Files Modified
1. `pages/api/ip-location.js` - Added state normalization map
2. `pages/api/geolocate.js` - Enhanced for multi-state support
3. `pages/index.js` - Updated auto-detection to set state + district

## Dependencies
- No new packages required
- Uses existing fetch API
- Works with current caching infrastructure
