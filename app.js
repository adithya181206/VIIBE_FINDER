
const GEOAPIFY_KEY = "e53550b28f404a01a6f6a011894082cd";
const WEATHER_KEY = "c1f45b062f5cac3103d3d11c41e70536";

let map, marker;
let userLat = 17.3850; 
let userLon = 78.4867;
let currentMood = "catering.cafe";
let savedPlaces = JSON.parse(localStorage.getItem("savedPlaces")) || [];
let isLoading = false;

const moodMapper = {
    park: "leisure.park",
    gym: "activity.sport.gym",
    jogging: "leisure.park,activity.sport.stadium",
    running: "leisure.park,activity.sport.stadium",
    workout: "activity.sport.gym",
    coffee: "catering.cafe",
    shopping: "commercial.shopping_mall,commercial.clothing",
    clothes: "commercial.clothing",
    cinema: "entertainment.cinema",
    movie: "entertainment.cinema",
    pizza: "catering.restaurant.pizza",
    medicine: "healthcare.pharmacy",
    atm: "service.financial.atm",
    hospital: "healthcare.hospital",
    temple: "amenity.place_of_worship"
};

function toggleTheme() {
    document.body.classList.toggle("dark-mode");
}

navigator.geolocation.getCurrentPosition(
    pos => {
        userLat = pos.coords.latitude;
        userLon = pos.coords.longitude;
        initMap(userLat, userLon);
    },
    () => {
        initMap(userLat, userLon);
        showMessage("📍 Location access denied. Using default location.");
    }
);

function initMap(lat, lon) {
    if (!map) {
        map = L.map("map").setView([lat, lon], 14);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

        map.on("click", e => {
            userLat = e.latlng.lat;
            userLon = e.latlng.lng;
            updateMarker(userLat, userLon);
            document.getElementById("manualLoc").value = "Selected on Map";
        });
    } else {
        map.setView([lat, lon], 14);
    }
    updateMarker(lat, lon);
}

function updateMarker(lat, lon) {
    if (marker) map.removeLayer(marker);
    marker = L.circleMarker([lat, lon], {
        radius: 9,
        color: "#2563eb",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 3
    }).addTo(map);
}

async function getWeather(lat, lon) {
    try {
        const res = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`
        );
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

function useMyLocation() {
    navigator.geolocation.getCurrentPosition(
        pos => {
            userLat = pos.coords.latitude;
            userLon = pos.coords.longitude;
            initMap(userLat, userLon);
            document.getElementById("manualLoc").value = "Current Location";
        },
        () => showMessage("❌ Unable to access your location")
    );
}

function setMood(btn, mood) {
    document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentMood = mood;
    document.getElementById("manualMood").value = "";
}

function clearSearch() {
    document.getElementById("manualLoc").value = "";
    document.getElementById("manualMood").value = "";
    document.getElementById("results").innerHTML = "";
}

async function handleSearch() {
    if (isLoading) return;
    isLoading = true;

    const loader = document.getElementById("loader");
    const results = document.getElementById("results");
    const moodInput = document.getElementById("manualMood").value.toLowerCase().trim();
    const locInput = document.getElementById("manualLoc").value;
    const radius = document.getElementById("rad").value;

    loader.style.display = "block";
    results.innerHTML = "";

    let lat = userLat, lon = userLon;

    if (locInput && locInput !== "Selected on Map" && locInput !== "Current Location") {
        try {
            const geoRes = await fetch(
                `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(locInput)}&apiKey=${GEOAPIFY_KEY}`
            );
            const geoData = await geoRes.json();
            if (geoData.features?.length) {
                lat = geoData.features[0].properties.lat;
                lon = geoData.features[0].properties.lon;
                initMap(lat, lon);
            }
        } catch {
            showMessage("❌ Location search failed");
        }
    }

    const weather = await getWeather(lat, lon);
    if (weather?.weather?.[0]?.main === "Rain") {
        showMessage("🌧️ It's raining. Indoor places are recommended.");
    }

    let category = currentMood;
    let textParam = "";

    if (moodInput) {
        if (moodMapper[moodInput]) {
            category = moodMapper[moodInput];
        } else {
            category = "any";
            textParam = `&text=${encodeURIComponent(moodInput)}`;
        }
    }

    const url = `https://api.geoapify.com/v2/places?categories=${category}${textParam}&filter=circle:${lon},${lat},${radius}&bias=proximity:${lon},${lat}&limit=12&apiKey=${GEOAPIFY_KEY}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();
        renderResults(data.features);
    } catch {
        results.innerHTML = "<p class='center'>❌ Failed to load places</p>";
    }

    loader.style.display = "none";
    isLoading = false;
}

function renderResults(features) {
    const container = document.getElementById("results");
    container.innerHTML = "";

    if (!features || features.length === 0) {
        container.innerHTML = "<p class='center'>No places found</p>";
        return;
    }

    features.sort((a, b) => a.properties.distance - b.properties.distance);

    features.forEach(f => {
        const p = f.properties;
        const dist = (p.distance / 1000).toFixed(1);

        const card = document.createElement("div");
        card.className = "place-card";

        card.onclick = () => {
            map.setView([p.lat, p.lon], 16);
            updateMarker(p.lat, p.lon);
        };

        card.innerHTML = `
            <div>
                <h3>${p.name || "Unnamed Place"}</h3>
                <p>📍 ${p.address_line1 || "Address unavailable"}</p>
                <p>⭐ Rating: Not available</p>
                <button onclick="event.stopPropagation(); openDirections(${p.lat}, ${p.lon})">Directions</button>
                <button onclick="event.stopPropagation(); savePlace('${p.name || "Unnamed Place"}')">❤️ Save</button>
            </div>
            <div class="dist-tag">${dist} KM</div>
        `;

        container.appendChild(card);
    });
}

function savePlace(name) {
    if (!savedPlaces.includes(name)) {
        savedPlaces.push(name);
        localStorage.setItem("savedPlaces", JSON.stringify(savedPlaces));
        showMessage("✅ Place saved");
    } else {
        showMessage("ℹ️ Already saved");
    }
}

function openDirections(lat, lon) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`);
}

function showMessage(msg) {
    const box = document.getElementById("message");
    if (!box) return;
    box.innerText = msg;
    box.style.display = "block";
    setTimeout(() => box.style.display = "none", 3000);
}
const locInput = document.getElementById("manualLoc");
const suggestionsBox = document.getElementById("suggestions");

let debounceTimer;

locInput.addEventListener("input", () => {
    const query = locInput.value.trim();
    clearTimeout(debounceTimer);

    if (query.length < 3) {
        suggestionsBox.innerHTML = "";
        return;
    }

    debounceTimer = setTimeout(() => fetchSuggestions(query), 300);
});

async function fetchSuggestions(query) {
    try {
        const res = await fetch(
            `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=5&apiKey=${GEOAPIFY_KEY}`
        );
        const data = await res.json();
        showSuggestions(data.features);
    } catch {
        suggestionsBox.innerHTML = "";
    }
}

function showSuggestions(features) {
    suggestionsBox.innerHTML = "";

    if (!features || features.length === 0) return;

    features.forEach(f => {
        const div = document.createElement("div");
        div.textContent = f.properties.formatted;

        div.onclick = () => {
            locInput.value = f.properties.formatted;
            userLat = f.properties.lat;
            userLon = f.properties.lon;
            initMap(userLat, userLon);
            suggestionsBox.innerHTML = "";
        };

        suggestionsBox.appendChild(div);
    });
}
document.addEventListener("click", e => {
    if (!e.target.closest(".suggestions") && e.target !== locInput) {
        suggestionsBox.innerHTML = "";
    }
});

