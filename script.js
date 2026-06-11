// ==================== FIREBASE CONFIGURATION ====================
// IMPORTANT: Replace these with your own Firebase project credentials


// Initialize Firebase
let shelterMarkers = [];
let db = null;
let map = null;
let currentMarker = null;
let currentLat = 0;
let currentLng = 0;
let routingControl = null;


// ==================== LEAFLET MAP INITIALIZATION ====================
function initializeMap() {
  if (!document.getElementById("disasterMap")) return;

  // Default location (India center)
  const defaultLat = 20.5937;
  const defaultLng = 78.9629;

  // Initialize map
  map = L.map('disasterMap').setView([defaultLat, defaultLng], 5);

  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    minZoom: 2
  }).addTo(map);

  // Handle map clicks
  map.on('click', function(e) {
    const lat = e.latlng.lat.toFixed(4);
    const lng = e.latlng.lng.toFixed(4);
    
    setLocation(lat, lng);
    updateMapMarker(lat, lng);
  });

  // Detect user location on load
  detectUserLocation();
}

// ==================== MAP MARKER MANAGEMENT ====================
function updateMapMarker(lat, lng) {
  // Remove existing marker
  if (currentMarker) {
    map.removeLayer(currentMarker);
  }

  // Add new marker
  currentMarker = L.marker([lat, lng]).addTo(map)
    .bindPopup(`<b>Disaster Location</b><br>Lat: ${lat}<br>Lng: ${lng}`);

  currentMarker.openPopup();

  // Center map on marker
  map.setView([lat, lng], 13);
}

// ==================== LOCATION MANAGEMENT ====================
function setLocation(lat, lng, skipReverse = false) {
  currentLat = parseFloat(lat);
  currentLng = parseFloat(lng);
  
  document.getElementById("latitude").value = lat;
  document.getElementById("longitude").value = lng;

  // Reverse geocoding only if needed
  if (!skipReverse) {
    getLocationName(lat, lng);
  }
}

function getLocationName(lat, lng) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
    .then(response => response.json())
    .then(data => {
      const locationName = data.address?.city || data.address?.town || data.address?.village || `${lat}, ${lng}`;
      document.getElementById("location").value = locationName;
    })
    .catch(error => {
      console.error("Reverse geocoding failed:", error);
      document.getElementById("location").value = `${lat}, ${lng}`;
    });
}
// search location
async function searchLocation(place) {
  if (!place) return;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${place}`
    );
    const data = await res.json();

    if (data.length === 0) {
      alert("Location not found 😕");
      return;
    }

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);

    const name = data[0].display_name.split(",")[0];
    document.getElementById("location").value = name;

    document.getElementById("latitude").value = lat;
    document.getElementById("longitude").value = lng;

    setLocation(lat, lng, true);
    updateMapMarker(lat, lng);
    const shelters = await fetchNearbyShelters(lat, lng);
    const nearest = getNearestShelter(shelters, lat, lng);
    showSheltersOnMap([nearest]);
    drawRoute(lat, lng, nearest.lat, nearest.lon);
    showSheltersOnMap(shelters);
  } catch (error) {
    console.error("Search error:", error);
    alert("Error finding location");
  }
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getNearestShelter(shelters, userLat, userLng) {
  let nearest = null;
  let minDist = Infinity;

  shelters.forEach(s => {
    if (!s.lat || !s.lon) return;

    const dist = getDistance(userLat, userLng, s.lat, s.lon);

    if (dist < minDist) {
      minDist = dist;
      nearest = { ...s, distance: dist };
    }
  });

  return nearest;
}
// route drawing
function drawRoute(userLat, userLng, destLat, destLng) {
  if (routingControl) {
    map.removeControl(routingControl);
  }

  routingControl = L.Routing.control({
    waypoints: [
      L.latLng(userLat, userLng),
      L.latLng(destLat, destLng)
    ],
    routeWhileDragging: false,
    show: false
  }).addTo(map);
}

async function fetchNearbyShelters(lat, lng) {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"~"hospital|clinic|shelter"](around:10000, ${lat}, ${lng});
    );
    out;
  `;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query
  });

  const data = await response.json();
  return data.elements;
}

function showSheltersOnMap(shelters) {
  // remove old shelters
  shelterMarkers.forEach(m => map.removeLayer(m));
  shelterMarkers = [];

  shelters.forEach(s => {
    if (!s.lat || !s.lon) return;

    const marker = L.marker([s.lat, s.lon], {
      icon: L.icon({
        iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
        iconSize: [32, 32]
      })
    })
    .addTo(map)
    .bindPopup(`🏥 ${s.tags?.name || "Nearby Shelter"}`);

    shelterMarkers.push(marker);
  });
}

function detectUserLocation() {
  const detectBtn = document.getElementById("detectBtn");
  if (!detectBtn) return;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        const lat = position.coords.latitude.toFixed(4);
        const lng = position.coords.longitude.toFixed(4);
        
        setLocation(lat, lng);
        updateMapMarker(lat, lng);
        
        if (detectBtn) detectBtn.innerText = "📍";
        console.log("Location detected:", lat, lng);
      },
      function(error) {
        console.warn("Geolocation error:", error);
        if (detectBtn) detectBtn.innerText = "📍";
      }
    );
  }
}

// ==================== LOCATION DETECTION BUTTON ====================
document.getElementById("detectBtn")?.addEventListener("click", function (e) {
  e.preventDefault();
  const btn = this;
  btn.innerText = "⏳";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(4);
      const lng = pos.coords.longitude.toFixed(4);
      
      setLocation(lat, lng);
      updateMapMarker(lat, lng);
      
      btn.innerText = "📍";
      console.log("Location detected successfully!");
    },
    () => {
      btn.innerText = "📍";
      alert("Unable to detect location. Please click on the map to pin your location.");
    }
  );
});

document.getElementById("location")?.addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    searchLocation(this.value);
  }
});
// ==================== FORM SUBMISSION ====================
document.getElementById("disasterForm")?.addEventListener("submit", async function (e) {
  e.preventDefault();

  const location = document.getElementById("location").value;
  const latitude = document.getElementById("latitude").value;
  const longitude = document.getElementById("longitude").value;
  const type = document.getElementById("type").value;
  const description = document.getElementById("description").value;
  const people = document.getElementById("people").value;
  const urgency = document.getElementById("urgency").value;

  // Validation
  if (!location || !type || !urgency || !latitude || !longitude) {
    alert("Please fill all required fields and set a location on the map.");
    return;
  }

  // Prepare data object
  const reportData = {
    location: location,
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    type: type,
    description: description,
    peopleAffected: parseInt(people) || 0,
    urgency: urgency,
    timestamp: new Date(),
    userId: "user_" + Date.now() // Simple user ID
  };

  // Save to Firebase if available
  if (window.db) {
    try {
      const docRef = await window.addDoc(
      window.collection(window.db, "disasterReports"),
      reportData
    );
      console.log("Report saved to Firebase with ID:", docRef.id);
      alert("Disaster report submitted successfully and saved to database!");
      const shelters = await fetchNearbyShelters(currentLat, currentLng);
      const nearest = getNearestShelter(shelters, currentLat, currentLng);
      showSheltersOnMap([nearest]);
      drawRoute(currentLat, currentLng, nearest.lat, nearest.lon);
      showSheltersOnMap(shelters);
      this.reset();
      
      
    } catch (error) {
      console.error("Firebase error:", error);
      alert("Report submitted locally. Firebase sync failed. Check your Firebase configuration.");
      this.reset();
    }
  } else {
    console.log("Report data (not saved to Firebase):", reportData);
    alert("Report submitted! Note: Firebase is not configured. Data not saved to database.");
    this.reset();
  }
});

// ==================== ACCORDION BUTTONS ====================
const buttons = document.querySelectorAll(".accordion-btn");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    const content = btn.nextElementSibling;
    const chevron = btn.querySelector(".chevron");

    if (content.style.maxHeight) {
      content.style.maxHeight = null;
      chevron.style.transform = "rotate(0deg)";
    } else {
      document.querySelectorAll(".accordion-content").forEach(c => {
        c.style.maxHeight = null;
      });
      document.querySelectorAll(".chevron").forEach(c => {
        c.style.transform = "rotate(0deg)";
      });

      content.style.maxHeight = content.scrollHeight + "px";
      chevron.style.transform = "rotate(180deg)";
    }
  });
});

// ==================== OTHER FORM HANDLING ====================
document.getElementById("reportForm")?.addEventListener("submit", function(e) {
    e.preventDefault();
    alert("Emergency Report Submitted!");
});

// ==================== INITIALIZE ON PAGE LOAD ====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMap);
} else {
  initializeMap();
}

