document.addEventListener("DOMContentLoaded", () => {
  const API = "/states";
  const map = L.map("map").setView([-14.235, -51.9253], 4);
  const yearFilter = document.getElementById("yearFilter");
  let geojsonLayer;
  let allStatesData = [];

  // Camada base do mapa
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 10,
  }).addTo(map);

  // Carrega os dados da API e do GeoJSON
  async function loadMapAndData() {
    const [geoRes, dataRes] = await Promise.all([
      fetch("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson"),
      fetch(API)
    ]);

    const geoData = await geoRes.json();
    allStatesData = await dataRes.json();

    populateYearFilter(allStatesData);
    renderGeoJSON(geoData, allStatesData);
    window.dispatchEvent(new CustomEvent("dataLoaded", { detail: allStatesData }));
  }

  // Preenche o seletor de ano dinamicamente
  function populateYearFilter(data) {
    const years = Array.from(new Set(data.map(s => s.ano))).sort();
    years.forEach(y => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearFilter.appendChild(opt);
    });
  }

  // Renderiza os estados no mapa
  function renderGeoJSON(geoData, data) {
    if (geojsonLayer) map.removeLayer(geojsonLayer);

    const stateByUF = {};
    data.forEach(s => stateByUF[s.uf.toUpperCase()] = s);

    function style() {
      return { fillColor:"#d9ead4", weight:1, color:"#6fa874", fillOpacity:0.7 };
    }

    function onEachFeature(feature, layer) {
      const uf = feature.properties.sigla;
      const s = stateByUF[uf];

      layer.on({
  click: async (e) => {
    const selectedYear = yearFilter.value;
    if (selectedYear && (!s || s.ano != selectedYear)) {
      layer.bindPopup(`<div class="disaster-card">Nenhum desastre em ${selectedYear} para ${feature.properties.nome}</div>`).openPopup();
      return;
    }

    if (!s) {
      layer.bindPopup(`<div class="disaster-card">Nenhum dado disponível para ${feature.properties.nome}</div>`).openPopup();
      return;
    }

    // 🔹 Cria popup básico com placeholder
    let cardHTML = `
      <div class="disaster-card">
        <h3>${s.estado} (${s.uf})</h3>
        <div><b>Capital:</b> ${s.capital}</div>
        <div><b>Evento:</b> ${s.evento || "Sem registro"}</div>
        <div><b>Fonte:</b> ${s.fonte || "—"}</div>
        <div><b>Ano:</b> ${s.ano || "—"}</div>
        <hr>
        <div id="weather-${s.uf}">🌦️ Carregando clima...</div>
      </div>
    `;
  

    layer.bindPopup(cardHTML).openPopup();

    // 🔹 Busca clima e temperatura
    try {
      const weatherRes = await fetch(`/weather?q=${encodeURIComponent(s.capital)}`);
      const weather = await weatherRes.json();

      if (weather.main) {
        const temp = weather.main.temp.toFixed(1);
        const desc = weather.weather[0].description;
        const icon = weather.weather[0].icon;

        document.getElementById(`weather-${s.uf}`).innerHTML = `
          <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}" style="vertical-align:middle">
          <b>${desc.charAt(0).toUpperCase() + desc.slice(1)}</b><br>
          🌡️ <b>Temperatura:</b> ${temp} °C
        `;
      } else {
        document.getElementById(`weather-${s.uf}`).innerHTML = "❌ Clima não disponível.";
      }
    } catch (err) {
      console.error("Erro ao obter clima:", err);
      document.getElementById(`weather-${s.uf}`).innerHTML = "❌ Erro ao carregar clima.";
    }
  }
});
    }

    geojsonLayer = L.geoJSON(geoData, { style, onEachFeature }).addTo(map);
  }

  // Ao mudar o ano → refiltra e atualiza mapa e gráfico
  yearFilter.addEventListener("change", () => {
    let filtered = []
    if(yearFilter.value){ // verifica se tem valor
      const selectedYears = Array.from(yearFilter.selectedOptions).map(o=>parseInt(o.value));

      filtered = selectedYears
      ? allStatesData.filter(s => selectedYears.includes(s.ano))
      : allStatesData;

    }else{ // se o valor for "Todos", retorna todos os dados
      filtered = allStatesData;
    }
    
    fetch("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson")
      .then(res => res.json())
      .then(geoData => renderGeoJSON(geoData, filtered));

    // Notifica o gráfico sobre a mudança
    window.dispatchEvent(new CustomEvent("yearChanged", { detail: filtered }));
  });

  loadMapAndData();
});
