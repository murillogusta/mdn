document.addEventListener("DOMContentLoaded", () => {
  const API_ESTADOS = "/states";
  const API_DESASTRES = "/disasters";
  const map = L.map("map").setView([-14.235, -51.9253], 4);
  const yearFilter = document.getElementById("yearFilter");
  let geojsonLayer;
  let allStatesData = [];
  let desastresData = [];

  // Camada base do mapa
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 10,
  }).addTo(map);

  // Carrega os dados da API e do GeoJSON
  async function loadMapAndData() {
    const [geoRes, dataRes] = await Promise.all([
      fetch("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson"),
      fetch(API_ESTADOS)
    ]);

    const geoData = await geoRes.json();
    allStatesData = await dataRes.json();

    renderGeoJSON(geoData, allStatesData);
    
    const desastresRes = await fetch(API_DESASTRES);
    desastresData = await desastresRes.json();
    populateYearFilter(desastresData);
    window.dispatchEvent(new CustomEvent("dataLoaded", { detail: desastresData }));

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

  // Conta desastres por estado
  function count_disasters(uf) {
    const selectedYears = getSelectedYears();
    if (selectedYears.length > 0) {
      return desastresData.filter(s => s.uf.toUpperCase() === uf.toUpperCase() && selectedYears.includes(s.ano)).length;
    }
    return desastresData.filter(s => s.uf.toUpperCase() === uf.toUpperCase()).length;
  }

  // Função para obter o clima atual de uma capital pelo UF
  async function getCurrentWheather(uf) {
    const state = allStatesData.find(s => s.uf.toUpperCase() === uf.toUpperCase());
    if (!state || !state.capital) return;
   
    const weatherRes = await fetch(`/weather?q=${state.capital},BR`);
    if (!weatherRes.ok) return; // Verifica se a resposta é válida
    const weatherData = await weatherRes.json();
    return `       
        <h4>Clima em ${state.capital}</h4>
        <div><b>Temperatura:</b> ${weatherData.main.temp} °C</div>
        <div><b>Condição:</b> ${weatherData.weather[0].description}</div>
      `;
      
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
<<<<<<< HEAD
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
=======
        mouseover: e => e.target.setStyle({ weight:2, color:"#2f6b46", fillColor:"#a9d9a1" }),
        mouseout: e => geojsonLayer.resetStyle(e.target),
        click: async e => {
          const selectedYear = yearFilter.value;
          
          // Filter disasters for the clicked state
          const stateDisasters = filterDisastersByState(uf);
          const weatherData = await getCurrentWheather(uf);
          
          if (selectedYear && (!s || !s.ano == selectedYear)) {
            layer.bindPopup(`<div class="disaster-card">Nenhum desastre em ${selectedYear} para ${feature.properties.nome}</div>`).openPopup();
            // Still populate table with state disasters (all years)
            populateDisasterTable(stateDisasters, feature.properties.nome);            
            scrollToTable();
            return;
          }
          if (!s) {
            layer.bindPopup(`<div class="disaster-card">Nenhum dado disponível para ${feature.properties.nome}</div>`).openPopup();
            return;
          }

          const cardHTML = `
            <div class="disaster-card">
              <h3>${s.estado} (${s.uf})</h3>
              <div><b>Capital:</b> ${s.capital}</div>
              <div><b>Desastres:</b> ${count_disasters(s.uf)}</div>
              <div style="margin-top: 10px; padding: 10px; border: 1px solid #ccc; border-radius: 5px; background-color: #f9f9f9;">
                ${weatherData || '<i>Dados de clima indisponíveis</i>'}
              </div>
              <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                <i>Clique para ver detalhes na tabela abaixo</i>
              </div>
            </div>`;
          layer.bindPopup(cardHTML).openPopup();
          
          // Populate table with disasters from clicked state
          populateDisasterTable(stateDisasters, feature.properties.nome);
          scrollToTable();
        }
      });
>>>>>>> 0e5663a6205aadd5314cd8c18fd7e95d02ce09f1
    }

    geojsonLayer = L.geoJSON(geoData, { style, onEachFeature }).addTo(map);
  }

  function getSelectedYears() {
    if (yearFilter.value === "") return [];
    const selectedYears = Array.from(yearFilter.selectedOptions).map(o=>parseInt(o.value));
    return selectedYears;
  }

  // Ao mudar o ano → refiltra e atualiza mapa e gráfico
  yearFilter.addEventListener("change", () => {
    let filtered = []
    if(yearFilter.value){ // verifica se tem valor
      const selectedYears = getSelectedYears();

      if(selectedYears.length === 0){
        filtered = desastresData;
      }else{
        filtered = selectedYears
        ? desastresData.filter(s => selectedYears.includes(s.ano))
        : desastresData;
      }

    }else{ // se o valor for "Todos", retorna todos os dados
      filtered = desastresData;
    }
    
    fetch("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson")
      .then(res => res.json())
      .then(geoData => {
        geoData.features = geoData.features.filter(f => filtered.some(s => s.uf.toUpperCase() === f.properties.sigla)) || filtered.length === 0;
        renderGeoJSON(geoData, filtered);
      });

    // Notifica o gráfico sobre a mudança
    window.dispatchEvent(new CustomEvent("yearChanged", { detail: filtered }));
  });

  // Função para preencher a tabela de desastres
  function populateDisasterTable(disasters, stateName = null) {
    const tableBody = document.querySelector('#disasterTable tbody');
    const tableStatus = document.getElementById('tableStatus');
    const showAllBtn = document.getElementById('showAllBtn');
    
    tableBody.innerHTML = ''; // Limpa a tabela

    selectedYears = getSelectedYears();
    if (selectedYears.length > 0) {
      disasters = disasters.filter(s => selectedYears.includes(s.ano));
    }

    // Atualiza o status da tabela
    if (stateName) {
      tableStatus.textContent = `Desastres em ${stateName} (${disasters.length} eventos)`;
      showAllBtn.style.display = 'inline-block';
    } else {
      tableStatus.textContent = `Todos os desastres (${disasters.length} eventos)`;
      showAllBtn.style.display = 'none';
    }

    disasters.forEach(disaster => {
      const row = document.createElement('tr');
      row.style.cssText = 'border-bottom:1px solid #eee; transition: background-color 0.2s ease;';
      
      // Extrair ano do evento se não tiver campo ano separado
      const year = disaster.ano || extractYearFromEvent(disaster.evento);
      
      row.innerHTML = `
        <td style="padding:10px; text-align:center;">${year || 'N/A'}</td>
        <td style="padding:10px;">${disaster.evento || 'N/A'}</td>
        <td style="padding:10px; text-align:center;">${disaster.estado} (${disaster.uf})</td>
        <td style="padding:10px;">${disaster.clima_descricao || 'N/A'}</td>
      `;
      
      // Adiciona hover effect
      row.addEventListener('mouseenter', () => {
        row.style.backgroundColor = '#f0f8f5';
      });
      
      row.addEventListener('mouseleave', () => {
        row.style.backgroundColor = '';
      });
      
      tableBody.appendChild(row);
    });
  }

  // Função auxiliar para extrair ano do texto do evento
  function extractYearFromEvent(evento) {
    const yearMatch = evento.match(/(\d{4})/);
    return yearMatch ? parseInt(yearMatch[1]) : null;
  }

  // Função para filtrar desastres por estado (UF)
  function filterDisastersByState(uf) {
    return desastresData.filter(disaster => 
      disaster.uf && disaster.uf.toUpperCase() === uf.toUpperCase()
    );
  }

  // Função para rolar suavemente até a tabela
  function scrollToTable() {
    const table = document.getElementById('disasterTable');
    if (table) {
      table.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }

  // Event listener para quando o filtro de ano muda
  window.addEventListener('yearChanged', (event) => {
    populateDisasterTable(event.detail);
  });

  loadMapAndData();
});

