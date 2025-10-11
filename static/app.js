document.addEventListener("DOMContentLoaded", () => {
  const API = "/states";
  const map = L.map("map").setView([-14.235, -51.9253], 4);
  const yearFilter = document.getElementById("yearFilter");

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 10,
  }).addTo(map);

  let geojsonLayer;
  let allStatesData = [];

  async function loadMapAndData() {
    const [geoRes, dataRes] = await Promise.all([
      fetch("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson"),
      fetch(API)
    ]);

    const geoData = await geoRes.json();
    allStatesData = await dataRes.json();

    populateYearFilter(allStatesData);
    renderGeoJSON(geoData, allStatesData);
  }

  function populateYearFilter(data) {
    const years = Array.from(new Set(data.map(s => s.data?.slice(0,4)))).filter(Boolean).sort();
    years.forEach(y => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearFilter.appendChild(opt);
    });
  }

  function renderGeoJSON(geoData, data) {
    if (geojsonLayer) map.removeLayer(geojsonLayer);

    const stateByUF = {};
    data.forEach(s => stateByUF[s.uf.toUpperCase()] = s);

    function style(feature) {
      return { fillColor:"#d9ead4", weight:1, color:"#6fa874", fillOpacity:0.7 };
    }

    function onEachFeature(feature, layer) {
      const uf = feature.properties.sigla;
      const s = stateByUF[uf];

      layer.on({
        mouseover: e => e.target.setStyle({ weight:2, color:"#2f6b46", fillColor:"#a9d9a1" }),
        mouseout: e => geojsonLayer.resetStyle(e.target),
        click: e => {
          const selectedYear = yearFilter.value;
          if (selectedYear && (!s || !s.data.startsWith(selectedYear))) {
            layer.bindPopup(`<div class="disaster-card">Nenhum desastre em ${selectedYear} para ${feature.properties.nome}</div>`).openPopup();
            return;
          }

          if (!s) {
            layer.bindPopup(`<div class="disaster-card">Nenhum dado disponível para ${feature.properties.nome}</div>`).openPopup();
            return;
          }

          const cardHTML = `
            <div class="disaster-card">
              <h3>${s.estado} (${s.uf})</h3>
              <div><span class="label">Capital:</span> ${s.capital}</div>
              <div><span class="label">Evento:</span> ${s.evento}</div>
              <div><span class="label">Clima:</span> ${s.clima_descricao}</div>
              <div><span class="label">Data:</span> ${s.data}</div>
              <div><span class="label">Fonte:</span> ${s.fonte}</div>
            </div>
          `;
          layer.bindPopup(cardHTML).openPopup();
        }
      });
    }

    geojsonLayer = L.geoJSON(geoData, { style, onEachFeature }).addTo(map);
  }
  
  yearFilter.addEventListener("change", () => {
    fetch("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson")
      .then(res => res.json())
      .then(geoData => renderGeoJSON(geoData, allStatesData));
  });

  loadMapAndData();
});
