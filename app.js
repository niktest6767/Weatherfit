const weatherCard = document.querySelector(".weather-card");
const setupHeader = document.querySelector("#setupHeader");
const durationOutput = document.querySelector("#durationOutput");
const decreaseDuration = document.querySelector("#decreaseDuration");
const increaseDuration = document.querySelector("#increaseDuration");
const quickDurationButtons = document.querySelectorAll("[data-hours]");
const weatherForm = document.querySelector("#weatherForm");
const locationButton = document.querySelector("#locationButton");
const manualToggle = document.querySelector("#manualToggle");
const manualLocation = document.querySelector("#manualLocation");
const cityInput = document.querySelector("#city");
const cityButton = document.querySelector("#cityButton");
const resultPanel = document.querySelector("#resultPanel");
const restartButton = document.querySelector("#restartButton");
const statusLine = document.querySelector("#statusLine");
const weatherOrb = document.querySelector("#weatherOrb");

const ui = {
  placeLabel: document.querySelector("#placeLabel"),
  summaryTitle: document.querySelector("#summaryTitle"),
  temperaturePill: document.querySelector("#temperaturePill"),
  accessoryEmoji: document.querySelector("#accessoryEmoji"),
  layerEmoji: document.querySelector("#layerEmoji"),
  topEmoji: document.querySelector("#topEmoji"),
  pantsEmoji: document.querySelector("#pantsEmoji"),
  extraEmoji: document.querySelector("#extraEmoji"),
  topAdvice: document.querySelector("#topAdvice"),
  pantsAdvice: document.querySelector("#pantsAdvice"),
  sunAdvice: document.querySelector("#sunAdvice"),
  laterAdvice: document.querySelector("#laterAdvice"),
  detailLine: document.querySelector("#detailLine"),
};

let selectedDuration = 3;

decreaseDuration.addEventListener("click", () => setDuration(selectedDuration - 1));
increaseDuration.addEventListener("click", () => setDuration(selectedDuration + 1));
quickDurationButtons.forEach((button) => {
  button.addEventListener("click", () => setDuration(Number(button.dataset.hours)));
});
weatherForm.addEventListener("submit", (event) => {
  event.preventDefault();
  useCurrentLocation();
});
manualToggle.addEventListener("click", () => {
  manualLocation.hidden = !manualLocation.hidden;
  if (!manualLocation.hidden) cityInput.focus();
});
cityButton.addEventListener("click", useManualCity);
cityInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    useManualCity();
  }
});
restartButton.addEventListener("click", showSetup);

setDuration(selectedDuration);

function setDuration(hours) {
  selectedDuration = Math.min(12, Math.max(1, hours));
  durationOutput.value = selectedDuration === 1 ? "1 Stunde" : `${selectedDuration} Stunden`;
  decreaseDuration.disabled = selectedDuration === 1;
  increaseDuration.disabled = selectedDuration === 12;
  quickDurationButtons.forEach((button) => {
    button.classList.toggle("is-selected", Number(button.dataset.hours) === selectedDuration);
    button.setAttribute("aria-pressed", String(Number(button.dataset.hours) === selectedDuration));
  });
}

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    showStatus("Dein Browser gibt keinen Standort frei. Gib einfach deinen Ort ein.");
    manualLocation.hidden = false;
    cityInput.focus();
    return;
  }

  setLoading(true, "Ich schaue kurz nach dem Wetter bei dir.");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        name: "Dein Standort",
      };
      await loadForecast(coords);
    },
    () => {
      setLoading(false);
      showStatus("Standort wurde nicht freigegeben. Du kannst unten deinen Ort eintippen.");
      manualLocation.hidden = false;
      cityInput.focus();
    },
    { enableHighAccuracy: false, maximumAge: 600000, timeout: 10000 }
  );
}

async function useManualCity() {
  const city = cityInput.value.trim();
  if (!city) {
    showStatus("Gib bitte zuerst einen Ort ein.");
    cityInput.focus();
    return;
  }

  try {
    setLoading(true, `Ich suche Wetterdaten für ${city}.`);
    const params = new URLSearchParams({
      name: city,
      count: "1",
      language: "de",
      format: "json",
    });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    if (!response.ok) throw new Error("Geocoding failed");
    const data = await response.json();
    const match = data.results?.[0];
    if (!match) {
      setLoading(false);
      showStatus("Den Ort habe ich nicht gefunden. Versuch es mit Stadt und Land.");
      return;
    }

    await loadForecast({
      latitude: match.latitude,
      longitude: match.longitude,
      name: [match.name, match.admin1, match.country].filter(Boolean).join(", "),
    });
  } catch {
    setLoading(false);
    showStatus("Gerade klappt die Ortssuche nicht. Prüfe deine Verbindung und versuch es nochmal.");
  }
}

async function loadForecast(location) {
  try {
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      timezone: "auto",
      forecast_days: "2",
      hourly: [
        "temperature_2m",
        "apparent_temperature",
        "precipitation_probability",
        "weather_code",
        "cloud_cover",
        "wind_speed_10m",
        "uv_index",
      ].join(","),
    });

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error("Forecast failed");
    const data = await response.json();
    const recommendation = buildRecommendation(data, selectedDuration, location.name);
    renderRecommendation(recommendation);
    setLoading(false);
    showStatus("");
  } catch {
    setLoading(false);
    showStatus("Wetterdaten konnten nicht geladen werden. Versuch es gleich nochmal.");
  }
}

function buildRecommendation(data, durationHours, placeName) {
  const hourly = data.hourly;
  const now = Date.now();
  const entries = hourly.time
    .map((time, index) => ({
      time: new Date(time).getTime(),
      temp: hourly.temperature_2m[index],
      feels: hourly.apparent_temperature[index],
      rain: hourly.precipitation_probability[index] ?? 0,
      code: hourly.weather_code[index],
      cloud: hourly.cloud_cover[index] ?? 100,
      wind: hourly.wind_speed_10m[index] ?? 0,
      uv: hourly.uv_index[index] ?? 0,
    }))
    .filter((entry) => entry.time >= now - 30 * 60 * 1000)
    .slice(0, Math.max(1, durationHours + 1));

  const temps = entries.map((entry) => entry.feels);
  const start = entries[0];
  const minFeels = Math.round(Math.min(...temps));
  const maxFeels = Math.round(Math.max(...temps));
  const lastFeels = Math.round(entries.at(-1).feels);
  const currentFeels = Math.round(start.feels);
  const maxRain = Math.max(...entries.map((entry) => entry.rain));
  const maxUv = Math.max(...entries.map((entry) => entry.uv));
  const avgCloud = Math.round(entries.reduce((sum, entry) => sum + entry.cloud, 0) / entries.length);
  const colderLater = currentFeels - minFeels >= 4 || currentFeels - lastFeels >= 3;
  const warmerLater = maxFeels - currentFeels >= 4;
  const weatherMood = getWeatherMood(start.code, maxRain, avgCloud);

  const top = getTopChoice(minFeels, currentFeels, colderLater, maxRain, start.wind);
  const pants = getPantsChoice(minFeels, maxFeels, maxRain, start.wind);
  const sun = getSunChoice(maxUv, avgCloud, maxRain);
  const extra = getExtraChoice(maxRain, start.wind);
  const title = getTitle(top, pants, sun, colderLater, warmerLater, maxRain);

  return {
    placeName,
    title,
    moodEmoji: weatherMood,
    temperature: currentFeels,
    range: `${minFeels} bis ${maxFeels}° gefühlt`,
    top,
    pants,
    sun,
    extra,
    later: getLaterText(colderLater, warmerLater, minFeels, maxFeels),
    detail: buildSimpleDetail(durationHours, currentFeels, minFeels, maxFeels, maxRain),
  };
}

function buildSimpleDetail(durationHours, currentFeels, minFeels, maxFeels, maxRain) {
  const timeText = durationHours === 1 ? "1h" : `${durationHours}h`;
  const temperatureText = minFeels === maxFeels ? `${currentFeels}°` : `${minFeels}-${maxFeels}°`;
  const rainText = maxRain >= 65 ? "Regen wahrscheinlich" : maxRain >= 35 ? "Vielleicht Regen" : "Kaum Regen";
  return `🕒 ${timeText}  🌡️ ${temperatureText}  🌧️ ${rainText}`;
}

function getTopChoice(minFeels, currentFeels, colderLater, rain, wind) {
  if (minFeels <= 5) return { emoji: "🧥", layer: "", label: "Warme Jacke" };
  if (minFeels <= 10) return { emoji: "🧥", layer: "🧣", label: "Jacke mit Schal" };
  if (minFeels <= 15 || wind > 25) return { emoji: "👕", layer: "🧥", label: "T-Shirt mit Jacke" };
  if (minFeels <= 19 || colderLater || rain > 45) return { emoji: "👕", layer: "🧥", label: "T-Shirt, etwas drüber" };
  if (currentFeels >= 27) return { emoji: "🎽", layer: "", label: "Sehr leichtes Shirt" };
  return { emoji: "👕", layer: "", label: "T-Shirt" };
}

function getPantsChoice(minFeels, maxFeels, rain, wind) {
  if (minFeels >= 20 && maxFeels >= 23 && rain < 45 && wind < 28) {
    return { emoji: "🩳", label: "Kurze Hose" };
  }
  return { emoji: "👖", label: "Lange Hose" };
}

function getSunChoice(maxUv, avgCloud, rain) {
  const sunglasses = maxUv >= 3 || (avgCloud < 55 && rain < 50);
  return {
    emoji: sunglasses ? "🕶️" : "",
    label: sunglasses ? "Sonnenbrille mitnehmen" : "Keine Sonnenbrille nötig",
  };
}

function getExtraChoice(maxRain, wind) {
  if (maxRain >= 65) return { emoji: "☂️", label: "Regenschirm" };
  if (wind >= 35) return { emoji: "💨", label: "Windig" };
  return { emoji: "", label: "" };
}

function getWeatherMood(code, rain, cloud) {
  if (rain >= 65 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if (cloud < 30) return "☀️";
  if (cloud < 70) return "⛅";
  return "☁️";
}

function getTitle(top, pants, sun, colderLater, warmerLater, rain) {
  if (rain >= 65) return "Nimm Regen ernst.";
  if (colderLater) return "Später wird's frischer.";
  if (warmerLater) return "Kann leichter werden.";
  if (sun.emoji) return "Sonnenbrille lohnt sich.";
  if (top.label === "T-Shirt" && pants.label === "Kurze Hose") return "Heute leicht raus.";
  return "So bist du gut angezogen.";
}

function getLaterText(colderLater, warmerLater, minFeels, maxFeels) {
  if (colderLater) return `Wird kühler bis ${minFeels}°`;
  if (warmerLater) return `Wird wärmer bis ${maxFeels}°`;
  return "Bleibt ähnlich";
}

function renderRecommendation(recommendation) {
  weatherCard.classList.add("has-result");
  setupHeader.hidden = true;
  weatherForm.hidden = true;
  resultPanel.hidden = false;
  weatherOrb.textContent = recommendation.moodEmoji;
  ui.placeLabel.textContent = recommendation.placeName;
  ui.summaryTitle.textContent = recommendation.title;
  ui.temperaturePill.textContent = `${recommendation.temperature}°`;
  ui.accessoryEmoji.textContent = recommendation.sun.emoji;
  ui.layerEmoji.textContent = recommendation.top.layer;
  ui.topEmoji.textContent = recommendation.top.emoji;
  ui.pantsEmoji.textContent = recommendation.pants.emoji;
  ui.extraEmoji.textContent = recommendation.extra.emoji;
  ui.topAdvice.textContent = recommendation.top.label;
  ui.pantsAdvice.textContent = recommendation.pants.label;
  ui.sunAdvice.textContent = recommendation.sun.label;
  ui.laterAdvice.textContent = recommendation.later;
  ui.detailLine.textContent = recommendation.detail;
}

function showSetup() {
  weatherCard.classList.remove("has-result");
  setupHeader.hidden = false;
  weatherForm.hidden = false;
  resultPanel.hidden = true;
  weatherOrb.textContent = "☁️";
  showStatus("");
}

function setLoading(isLoading, message = "") {
  document.body.classList.toggle("is-loading", isLoading);
  locationButton.textContent = isLoading ? "Einen Moment ..." : "Standort verwenden";
  cityButton.textContent = isLoading ? "..." : "Prüfen";
  showStatus(message);
}

function showStatus(message) {
  statusLine.textContent = message;
}
