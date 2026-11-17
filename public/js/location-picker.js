document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('[data-location-picker]');
  if (!root) return;

  const searchInput = root.querySelector('#location-address');
  const searchControl = root.querySelector('.location-search-control');
  const searchButton = root.querySelector('[data-location-search]');
  const clearButton = root.querySelector('[data-location-clear]');
  const currentButton = root.querySelector('[data-current-location]');
  const status = root.querySelector('[data-location-status]');
  const results = root.querySelector('[data-location-results]');
  const mapContainer = root.querySelector('[data-location-map]');
  const mapError = root.querySelector('[data-map-error]');
  const mapErrorMessage = root.querySelector('[data-map-error-message]');
  const mapRetryButton = root.querySelector('[data-map-retry]');
  const latitudeInput = root.querySelector('[data-location-latitude]');
  const longitudeInput = root.querySelector('[data-location-longitude]');
  if (!searchInput || !searchControl || !searchButton || !clearButton || !currentButton || !status || !results || !latitudeInput || !longitudeInput) return;

  const tamil = document.documentElement.lang === 'ta';
  const text = tamil ? {
    minSearch: 'இடத்தைத் தேட குறைந்தது 3 எழுத்துகளை உள்ளிடவும்.', searching: 'இடங்களைத் தேடுகிறது…',
    noResults: 'இடம் கிடைக்கவில்லை. அருகிலுள்ள தெரு, அடையாளம் அல்லது பகுதியை முயற்சிக்கவும்.', choose: 'சரியான முகவரைத் தேர்ந்தெடுக்கவும்.',
    unavailable: 'இடத் தேடல் தற்காலிகமாக கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.', failed: 'இந்த இடத்தைத் தேட முடியவில்லை.', locating: 'உங்கள் தற்போதைய இடத்தைக் கண்டறிகிறது…',
    noGeolocation: 'இந்த உலாவியில் இட அணுகல் இல்லை. அதற்குப் பதிலாக முகவரியைத் தேடவும்.', denied: 'இட அணுகல் தடுக்கப்பட்டது. முகவரியைத் தேடவும் அல்லது கைமுறையாக உள்ளிடவும்.',
    failedLocation: 'உங்கள் இடத்தைக் கண்டறிய முடியவில்லை. முகவரியைத் தேடவும் அல்லது கைமுறையாக உள்ளிடவும்.', pinned: 'உங்கள் தற்போதைய இட முகவரி நிரப்பப்பட்டது.',
    selectedPrefix: 'தேர்ந்தெடுக்கப்பட்ட இடம்', countSuffix: 'இடங்கள் கிடைத்தன.', initialHint: 'இடத்தைத் தேடவும் அல்லது முகவரியை கைமுறையாக உள்ளிடவும்.', pinSelected: 'குறிப்பிட்ட இடம்',
    mapTilesError: 'வரைபட ஓடுகள் ஏற்றப்படவில்லை. முகவரித் தேடலும் தற்போதைய இடமும் தொடர்ந்து செயல்படும்.', mapUnavailable: 'வரைபடம் ஏற்றப்படவில்லை. முகவரியைத் தேடவும் அல்லது தற்போதைய இடத்தைப் பயன்படுத்தவும்.', retryMap: 'வரைபடத்தை மீண்டும் முயற்சிக்கவும்'
  } : {
    minSearch: 'Enter at least 3 characters to search for a place.', searching: 'Searching nearby locations…',
    noResults: 'No places found. Try a nearby street, landmark, or neighborhood.', choose: 'Choose the correct address from the results.',
    unavailable: 'Location search is temporarily unavailable. Please try again.', failed: 'Could not search for that location.', locating: 'Finding your current location…',
    noGeolocation: 'Location access is not available in this browser. Search for an address instead.', denied: 'Location access was blocked. Search for an address or enter it manually.',
    failedLocation: 'Could not get your location. Search for an address or enter it manually.', pinned: 'Your current location address has been filled in.',
    selectedPrefix: 'Selected location', countSuffix: 'locations found.', initialHint: 'Search for a place, or enter the address manually.', pinSelected: 'Pinned coordinates',
    mapTilesError: 'Map tiles did not load. Address search and current location are still available.', mapUnavailable: 'The map could not load. Search for an address or use your current location instead.', retryMap: 'Retry map'
  };

  let debounceTimer;
  let activeController;
  let requestSequence = 0;
  let map;
  let marker;
  let mapTiles;
  let tileErrorCount = 0;
  let coordinateSequence = 0;

  const setStatus = message => { status.textContent = message; };
  const defaultCenter = [20.5937, 78.9629];

  function showMapError(message = text.mapTilesError) {
    if (!mapError || !mapErrorMessage) return;
    mapErrorMessage.textContent = message;
    mapError.hidden = false;
  }

  function createPinIcon() {
    return window.L.divIcon({
      className: 'urbanreport-map-icon',
      html: '<span class="urbanreport-map-pin"><svg viewBox="0 0 32 40" aria-hidden="true"><path d="M16 1.5C7.99 1.5 1.5 7.86 1.5 15.72c0 10.15 14.5 22.78 14.5 22.78s14.5-12.63 14.5-22.78C30.5 7.86 24.01 1.5 16 1.5Z"/><circle cx="16" cy="15.5" r="5.25"/></svg></span>',
      iconSize: [38, 46],
      iconAnchor: [19, 44],
      tooltipAnchor: [0, -40]
    });
  }

  function setMapLocation(lat, lon, zoom = 16) {
    if (!map) return;
    const point = [Number(lat), Number(lon)];
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;
    map.setView(point, Math.max(map.getZoom(), zoom));
    if (marker) marker.setLatLng(point);
    else {
      marker = window.L.marker(point, { icon: createPinIcon(), draggable: true, title: 'Drag to fine-tune the issue location' }).addTo(map);
      marker.on('dragend', () => {
        const point = marker.getLatLng();
        chooseCoordinates(point.lat, point.lng);
      });
    }
  }

  async function addressForCoordinates(latitude, longitude) {
    const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), lang: tamil ? 'ta' : 'en' });
    const response = await fetch(`https://photon.komoot.io/reverse?${params}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(text.unavailable);
    const data = await response.json();
    const feature = data.features?.[0];
    return formatAddress(feature?.properties) || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }

  async function chooseCoordinates(latitude, longitude) {
    const sequence = ++coordinateSequence;
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return;

    // Persist the pin immediately so a quick submit cannot save stale or empty coordinates.
    latitudeInput.value = lat.toFixed(6);
    longitudeInput.value = lon.toFixed(6);
    searchInput.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    searchControl.classList.add('has-selection');
    clearButton.hidden = false;
    currentButton.hidden = true;
    closeResults();
    setMapLocation(lat, lon, Math.max(map?.getZoom() || 0, 16));
    setStatus(`${text.pinSelected}: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    try {
      const address = await addressForCoordinates(lat, lon);
      if (sequence === coordinateSequence) updateSelection(address, lat, lon);
    } catch (_error) {
      if (sequence === coordinateSequence) setStatus(`${text.pinSelected}: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    }
  }

  if (mapContainer && window.L) {
    map = window.L.map(mapContainer, { scrollWheelZoom: true }).setView(defaultCenter, 5);
    mapTiles = window.L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · Tiles style by <a href="https://www.hotosm.org/" target="_blank" rel="noopener">HOT</a>, hosted by <a href="https://www.openstreetmap.fr/" target="_blank" rel="noopener">OpenStreetMap France</a>'
    }).on('tileerror', () => {
      tileErrorCount += 1;
      if (tileErrorCount >= 2) showMapError();
    }).addTo(map);
    map.on('click', event => chooseCoordinates(event.latlng.lat, event.latlng.lng));
    window.setTimeout(() => map.invalidateSize(), 150);
  } else if (mapContainer) {
    mapContainer.textContent = text.mapUnavailable;
    showMapError(text.mapUnavailable);
  }

  mapRetryButton?.addEventListener('click', () => {
    if (!mapTiles) return;
    tileErrorCount = 0;
    mapError.hidden = true;
    mapTiles.redraw();
  });

  searchInput.setAttribute('aria-expanded', 'false');
  if (searchInput.value && latitudeInput.value && longitudeInput.value) {
    searchControl.classList.add('has-selection');
    clearButton.hidden = false;
    currentButton.hidden = true;
    setStatus(`${text.selectedPrefix}: ${searchInput.value}`);
    setMapLocation(latitudeInput.value, longitudeInput.value, 16);
  }
  const closeResults = () => {
    results.hidden = true;
    results.replaceChildren();
    searchInput.setAttribute('aria-expanded', 'false');
  };

  function updateSelection(address, lat, lon) {
    coordinateSequence += 1;
    searchInput.value = address;
    latitudeInput.value = Number(lat).toFixed(6);
    longitudeInput.value = Number(lon).toFixed(6);
    searchControl.classList.add('has-selection');
    clearButton.hidden = false;
    currentButton.hidden = true;
    setMapLocation(lat, lon, 16);
    searchInput.setAttribute('aria-expanded', 'false');
    closeResults();
    setStatus(`${text.selectedPrefix}: ${address}`);
  }

  function formatAddress(properties = {}) {
    const street = [properties.housenumber, properties.street].filter(Boolean).join(' ');
    const parts = [properties.name && properties.name !== street ? properties.name : '', street,
      properties.locality, properties.suburb, properties.district, properties.city, properties.county,
      properties.state, properties.postcode, properties.country].filter(Boolean);
    return [...new Set(parts.map(part => String(part).trim()).filter(Boolean))].join(', ');
  }

  async function fetchFeatures(query, sequence) {
    if (sequence !== requestSequence) return null;
    if (activeController) activeController.abort();
    activeController = new AbortController();
    const params = new URLSearchParams({
      q: query,
      limit: '6',
      lang: tamil ? 'ta' : 'en',
      lat: '20.5937',
      lon: '78.9629',
      zoom: '5'
    });
    const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
      headers: { Accept: 'application/json' },
      signal: activeController.signal
    });
    if (!response.ok) throw new Error(text.unavailable);
    const data = await response.json();
    return data.features || [];
  }

  function renderResults(features) {
    results.replaceChildren();
    const places = features.map(feature => {
      const props = feature.properties || {};
      const address = formatAddress(props);
      return {
        address: formatAddress(props),
        title: props.name || props.street || address.split(',')[0],
        lat: feature.geometry?.coordinates?.[1],
        lon: feature.geometry?.coordinates?.[0]
      };
    }).filter(place => place.address && Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon)));

    if (!places.length) {
      closeResults();
      setStatus(text.noResults);
      return;
    }

    places.forEach(place => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'location-result';
      option.setAttribute('role', 'option');
      const title = document.createElement('strong');
      title.textContent = place.title;
      const address = document.createElement('small');
      address.textContent = place.address;
      option.append(title, address);
      option.addEventListener('click', () => updateSelection(place.address, place.lat, place.lon));
      results.append(option);
    });
    results.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    setStatus(`${places.length} ${text.countSuffix} ${text.choose}`);
  }

  async function lookupCurrentValue() {
    const query = searchInput.value.trim();
    if (query.length < 3) {
      closeResults();
      setStatus(text.minSearch);
      return;
    }
    const sequence = ++requestSequence;
    setStatus(text.searching);
    try {
      const features = await fetchFeatures(query, sequence);
      if (sequence === requestSequence && features) renderResults(features);
    } catch (error) {
      if (error.name !== 'AbortError' && sequence === requestSequence) {
        closeResults();
        setStatus(error.message || text.failed);
      }
    }
  }

  searchInput.addEventListener('input', () => {
    coordinateSequence += 1;
    window.clearTimeout(debounceTimer);
    requestSequence += 1;
    if (activeController) activeController.abort();
    latitudeInput.value = '';
    longitudeInput.value = '';
    if (marker && map) { map.removeLayer(marker); marker = null; }
    searchControl.classList.remove('has-selection');
    clearButton.hidden = true;
    currentButton.hidden = false;
    closeResults();
    const query = searchInput.value.trim();
    if (query.length < 3) {
      setStatus(query ? text.minSearch : text.initialHint);
      return;
    }
    setStatus(text.searching);
    debounceTimer = window.setTimeout(lookupCurrentValue, 450);
  });

  searchButton.addEventListener('click', lookupCurrentValue);
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      lookupCurrentValue();
    } else if (event.key === 'Escape') closeResults();
  });

  clearButton.addEventListener('click', () => {
    coordinateSequence += 1;
    searchInput.value = '';
    latitudeInput.value = '';
    longitudeInput.value = '';
    if (marker && map) { map.removeLayer(marker); marker = null; map.setView(defaultCenter, 5); }
    searchControl.classList.remove('has-selection');
    clearButton.hidden = true;
    currentButton.hidden = false;
    closeResults();
    setStatus(text.initialHint);
    searchInput.focus();
  });

  currentButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setStatus(text.noGeolocation);
      return;
    }
    currentButton.disabled = true;
    setStatus(text.locating);
    navigator.geolocation.getCurrentPosition(async position => {
      const { latitude, longitude } = position.coords;
      try {
        const address = await addressForCoordinates(latitude, longitude);
        updateSelection(address, latitude, longitude);
      } catch (error) {
        updateSelection(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, latitude, longitude);
        setStatus(text.pinned);
      } finally {
        currentButton.disabled = false;
      }
    }, error => {
      currentButton.disabled = false;
      setStatus(error.code === error.PERMISSION_DENIED ? text.denied : text.failedLocation);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
});
