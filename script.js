/* ==========================
QUICK START — IMPORTANT
1) Get a FREE API key from https://openweathermap.org/api
2) Replace the placeholder below.
========================== */
const OPENWEATHER_API_KEY = "";

// Basic helpers
const $ = (sel) => document.querySelector(sel);
const fmtInt = (n) => Math.round(n).toString();
const toKmh = (ms) => (ms * 3.6).toFixed(0);
const toMph = (ms) => (ms * 2.23694).toFixed(0);
const dtFmt = (ts, tz) => new Date((ts + tz) * 1000);
const pad = (n) => String(n).padStart(2, "0");

// State
const state = {
  map: null,
  marker: null,
  overlay: null,
  units: localStorage.getItem("units") || "metric",
  last: JSON.parse(localStorage.getItem("lastCoord") || "null") || {
    lat: 12.9716,
    lon: 77.5946,
  }, // Bengaluru default
  lastName: localStorage.getItem("lastName") || "Bengaluru, IN",
  theme: localStorage.getItem("theme") || "night",
  chart: null,
};

// Theme handling
function applyTheme() {
  const isDay = state.theme === "day";
  document.body.classList.toggle("day", isDay);
  const btn = $("#btnTheme");
  btn.textContent = isDay ? "☀️ Day" : "🌙 Night";
  btn.setAttribute("aria-pressed", String(isDay));
}

$("#btnTheme").addEventListener("click", () => {
  state.theme = state.theme === "day" ? "night" : "day";
  localStorage.setItem("theme", state.theme);
  applyTheme();
});
applyTheme();

// Init units UI
$("#units").value = state.units;

// Map init
const map = L.map("map", { zoomControl: true });
state.map = map;
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Weather overlay function
function setWeatherLayer(layerId) {
  if (state.overlay) {
    state.map.removeLayer(state.overlay);
    state.overlay = null;
  }
  if (!layerId) return;
  const url = `https://tile.openweathermap.org/map/${layerId}/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;
  const opacity = parseFloat($("#layerOpacity").value || "0.7");
  state.overlay = L.tileLayer(url, {
    opacity,
    attribution: "Weather tiles © OpenWeather",
  });
  state.overlay.addTo(state.map);
}

$("#layerSelect").addEventListener("change", (e) =>
  setWeatherLayer(e.target.value)
);

$("#layerOpacity").addEventListener("input", (e) => {
  if (state.overlay) {
    state.overlay.setOpacity(parseFloat(e.target.value));
  }
});

// Marker helpers
function setMarker(lat, lon, label) {
  if (state.marker) state.map.removeLayer(state.marker);
  state.marker = L.marker([lat, lon])
    .addTo(state.map)
    .bindPopup(label || "")
    .openPopup();
}

// API helpers
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("API error " + r.status);
  return r.json();
}

async function geocodeCity(q) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
    q
  )}&limit=1&appid=${OPENWEATHER_API_KEY}`;
  const [hit] = await getJSON(url);
  if (!hit) throw new Error("City not found");
  const name = `${hit.name}${hit.state ? ", " + hit.state : ""}, ${hit.country
    }`;
  return { lat: hit.lat, lon: hit.lon, name };
}

async function reverseGeocode(lat, lon) {
  const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OPENWEATHER_API_KEY}`;
  const [hit] = await getJSON(url);
  if (hit) {
    return `${hit.name}${hit.state ? ", " + hit.state : ""}, ${hit.country}`;
  }
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

async function fetchAll(lat, lon) {
  const units = state.units;
  const cur = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${OPENWEATHER_API_KEY}`;
  const fc = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${OPENWEATHER_API_KEY}`;
  const aqi = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;
  const [cw, fw, aq] = await Promise.all([
    getJSON(cur),
    getJSON(fc),
    getJSON(aqi),
  ]);
  return { cw, fw, aq };
}

// UI update
function weatherEmoji(id) {
  if (id >= 200 && id < 300) return "⛈️";
  if (id >= 300 && id < 600) return "🌧️";
  if (id >= 600 && id < 700) return "❄️";
  if (id === 711) return "🌫️";
  if (id >= 700 && id < 800) return "🌁";
  if (id === 800) return "☀️";
  if (id === 801) return "🌤️";
  if (id === 802) return "⛅";
  if (id >= 803) return "☁️";
  return "🌡️";
}

function setCurrent(cw) {
  const u = state.units;
  $("#city").textContent = `${cw.name}, ${cw.sys.country}`;
  $("#temp").textContent = `${fmtInt(cw.main.temp)}°${u === "metric" ? "C" : "F"
    }`;
  $("#desc").textContent = cw.weather?.[0]?.description || "";
  $("#wIcon").textContent = weatherEmoji(cw.weather?.[0]?.id || 800);

  $("#feels").textContent = `${fmtInt(cw.main.feels_like)}°`;
  $("#hum").textContent = `${cw.main.humidity}%`;
  const wind =
    u === "imperial"
      ? `${toMph(cw.wind.speed)} mph`
      : `${toKmh(cw.wind.speed)} km/h`;
  $("#wind").textContent = `${wind} ${cw.wind.deg != null ? "• " + cw.wind.deg + "°" : ""
    }`;
  $("#press").textContent = `${cw.main.pressure} hPa`;
  $("#vis").textContent = `${(cw.visibility / 1000).toFixed(1)} km`;

  const tz = cw.timezone || 0;
  const sr = dtFmt(cw.sys.sunrise, tz);
  const ss = dtFmt(cw.sys.sunset, tz);
  $("#sun").textContent = `${pad(sr.getHours())}:${pad(
    sr.getMinutes()
  )} / ${pad(ss.getHours())}:${pad(ss.getMinutes())}`;
}

function setAQI(aq) {
  const val = aq?.list?.[0]?.main?.aqi || 0;
  const comps = aq?.list?.[0]?.components || {};
  const label =
    ["—", "Good", "Fair", "Moderate", "Poor", "Very Poor"][val] || "—";
  const bg =
    ["#0b1220", "#065f46", "#065f46", "#92400e", "#7f1d1d", "#7f1d1d"][val] ||
    "#0b1220";
  const fg =
    ["#e5e7eb", "#a7f3d0", "#a7f3d0", "#fde68a", "#fecaca", "#fecaca"][val] ||
    "#e5e7eb";
  const el = $("#aqiBadge");
  el.textContent = `AQI ${val || "—"} — ${label}`;
  el.style.background = bg;
  el.style.color = fg;
  el.style.borderColor = "var(--border)";

  // components in μg/m3 (CO is mg/m3 in API docs; convert to μg/m3 *1000)
  $("#pm25").textContent = comps.pm2_5 != null ? comps.pm2_5.toFixed(1) : "—";
  $("#pm10").textContent = comps.pm10 != null ? comps.pm10.toFixed(1) : "—";
  $("#no2").textContent = comps.no2 != null ? comps.no2.toFixed(1) : "—";
  $("#o3").textContent = comps.o3 != null ? comps.o3.toFixed(1) : "—";
  $("#so2").textContent = comps.so2 != null ? comps.so2.toFixed(1) : "—";
  $("#co").textContent = comps.co != null ? (comps.co * 1).toFixed(1) : "—";
}

function setForecast(fw) {
  // Build hourly (next 24h) from 3h steps
  const hours = fw.list.slice(0, 8); // 8 * 3h = 24h
  const labels = hours.map((x) => x.dt_txt.slice(11, 16));
  const temps = hours.map((x) => x.main.temp);

  if (state.chart) {
    state.chart.destroy();
  }
  const ctx = document.getElementById("hourlyChart");
  state.chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{ label: "Temp", data: temps, tension: 0.35, fill: true }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(0,0,0,.15)" } },
      },
    },
  });

  // Build 5-day summary
  const byDay = {};
  for (const item of fw.list) {
    const d = item.dt_txt.slice(0, 10);
    byDay[d] = byDay[d] || { temps: [], icons: [] };
    byDay[d].temps.push(item.main.temp);
    byDay[d].icons.push(item.weather?.[0]?.id || 800);
  }
  const days = Object.entries(byDay).slice(0, 5);
  const fc = $("#forecast");
  fc.innerHTML = "";
  for (const [date, obj] of days) {
    const tmin = Math.min(...obj.temps);
    const tmax = Math.max(...obj.temps);
    // choose most frequent icon id
    const counts = obj.icons.reduce(
      (m, v) => ((m[v] = (m[v] || 0) + 1), m),
      {}
    );
    const id = Object.entries(counts)
      .sort((a, b) => a[1] - b[1])
      .pop()[0];
    const d = new Date(date);
    const day = d.toLocaleDateString(undefined, { weekday: "short" });
    const el = document.createElement("div");
    el.className = "fcard";
    el.innerHTML = `<div class="day">${day}</div><div class="ix">${weatherEmoji(
      Number(id)
    )}</div><div>${fmtInt(tmin)}° / ${fmtInt(tmax)}°</div>`;
    fc.appendChild(el);
  }
}

async function updateAll(lat, lon, label) {
  try {
    const { cw, fw, aq } = await fetchAll(lat, lon);
    setCurrent(cw);
    setAQI(aq);
    setForecast(fw);
    state.map.setView([lat, lon], 10);
    setMarker(lat, lon, label || `${cw.name}, ${cw.sys.country}`);
    state.last = { lat, lon };
    localStorage.setItem("lastCoord", JSON.stringify(state.last));
    const name = label || `${cw.name}, ${cw.sys.country}`;
    state.lastName = name;
    localStorage.setItem("lastName", name);
  } catch (err) {
    alert(
      "Failed to load weather data. Check your API key and network.\\n" +
      err.message
    );
  }
}

// Events
$("#btnSearch").addEventListener("click", async () => {
  const q = $("#q").value.trim();
  if (!q) return;
  try {
    const g = await geocodeCity(q);
    await updateAll(g.lat, g.lon, g.name);
  } catch (err) {
    alert(err.message);
  }
});

$("#q").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#btnSearch").click();
});

$("#btnLocate").addEventListener("click", () => {
  if (!navigator.geolocation)
    return alert("Geolocation not supported on this browser.");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const name = await reverseGeocode(lat, lon);
      updateAll(lat, lon, name);
    },
    (err) => alert("Location error: " + err.message),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

$("#units").addEventListener("change", () => {
  state.units = $("#units").value;
  localStorage.setItem("units", state.units);
  if (state.last) updateAll(state.last.lat, state.last.lon, state.lastName);
});

state.map?.on?.("click", async (ev) => {
  const { lat, lng } = ev.latlng;
  const name = await reverseGeocode(lat, lng);
  updateAll(lat, lng, name);
});

// Kick off — last viewed location
(async function init() {
  map.setView([state.last.lat, state.last.lon], 10);
  setMarker(state.last.lat, state.last.lon, state.lastName);
  setWeatherLayer($("#layerSelect").value);
  updateAll(state.last.lat, state.last.lon, state.lastName);
})();
