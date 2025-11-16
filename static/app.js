// static/app.js
document.addEventListener("DOMContentLoaded", () => {
  const API_MUNICIPIOS = "/api/municipios";
  const API_ESTADOS_RESUMO = "/api/estados_resumo";
  const API_FILTROS = "/api/filtros";

  const map = L.map("map").setView([-14.235, -51.9253], 4);

  // Filtro de ano principal (pode estar no header ou dentro do mapFilters)
  const yearFilter = document.getElementById("yearFilter");

  // Filtros da tabela / gráfico
  const estadoFilter = document.getElementById("estadoFilter");
  const municipioFilter = document.getElementById("municipioFilter");
  const anoFilter = document.getElementById("anoFilter");
  const applyBtn = document.getElementById("applyFilters");
  const clearBtn = document.getElementById("clearFilters");

  // Filtros do mapa (nomes possíveis: mapAnoFilter ou yearFilter dependendo do HTML)
  const mapAnoElem = document.getElementById("mapAnoFilter") || yearFilter || null;
  const mapEstadoFilter = document.getElementById("mapEstadoFilter");

  let geojsonLayer = null;
  let municipiosCache = [];
  let filtrosCache = { estados: [], municipios: [], anos: [] };
  let chartInstance = null;

  // cria gráfico vazio inicial
function initChart() {
  const ctx = document.getElementById("barChart").getContext("2d");
  chartInstance = new Chart(ctx, {
  type: "bar",
  data: {
    labels: [],
    datasets: [
      {
        label: "Eventos por ano",
        data: [],
        backgroundColor: "rgba(54, 162, 235, 0.5)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,

    scales: {
      x: {
        title: {
          display: true,
          text: "Ano"
        },

        ticks: {
          autoSkip: false,   // <- FORÇA A EXIBIR TODOS OS ANOS
          maxRotation: 90,   // <- Mantém os números verticais
          minRotation: 90,
          font: {
            size: 10         // <- Tamanho ideal para muitos anos
          }
        },

        grid: {
          display: false
        }
      },

      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Eventos"
        },
        ticks: {
          precision: 0
        }
      }
    },

    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true
      }
    }
  }
});
}

  

  // paginação
  let currentOffset = 0;
  const PAGE_SIZE = 200;
  let loading = false;
  let allLoaded = false;

  // tile layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 10
  }).addTo(map);

  // ---------------------------
  // Populate filtros
  // ---------------------------
  function populateMapFilters(filtros) {
    // anos
    const anos = Array.from(new Set(filtros.anos || [])).sort();
    if (mapAnoElem) {
      // limpa existentes (sem remover a opção "Todos" se houver)
      if (mapAnoElem.tagName === "SELECT") {
        mapAnoElem.innerHTML = '<option value="">Todos</option>';
        anos.forEach(a => {
          const opt = document.createElement("option");
          opt.value = a;
          opt.textContent = a;
          mapAnoElem.appendChild(opt);
        });
      }
    }
    // estados do mapa
    if (mapEstadoFilter) {
      mapEstadoFilter.innerHTML = '<option value="">Todos</option>';
      (filtros.estados || []).forEach(e => {
        const opt = document.createElement("option");
        opt.value = e;
        opt.textContent = e;
        mapEstadoFilter.appendChild(opt);
      });
    }
  }

  filtrosCache = {}; // garante que existe

function populateFilters(filtros) {
  filtrosCache = filtros;  // 🔥 salva os filtros corretamente

  if (estadoFilter) {
    estadoFilter.innerHTML = '<option value="">Todos</option>';
    (filtros.estados || []).forEach(uf => {
      const opt = document.createElement("option");
      opt.value = uf;
      opt.textContent = uf;
      estadoFilter.appendChild(opt);
    });
  }

  if (municipioFilter) {
    municipioFilter.innerHTML = '<option value="">Todos</option>';
    (filtros.municipios || []).forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      municipioFilter.appendChild(opt);
    });
  }

  if (anoFilter) {
    anoFilter.innerHTML = '<option value="">Todos</option>';
    (filtros.anos || []).forEach(a => {
      const opt = document.createElement("option");
      opt.value = a;
      opt.textContent = a;
      anoFilter.appendChild(opt);
    });
  }
}


// Atualização dinâmica dos municípios ao trocar o estado
if (estadoFilter) {
  estadoFilter.addEventListener("change", async function () {
    const estado = this.value;

    municipioFilter.innerHTML = '<option value="">Todos</option>';

    // Caso o estado volte para "Todos"
    if (!estado) {
      (filtrosCache.municipios || []).forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        municipioFilter.appendChild(opt);
      });
      return;
    }

    try {
      const res = await fetch(
        `/api/municipios_por_estado?estado=${encodeURIComponent(estado)}`
      );
      const data = await res.json();

      data.forEach(mun => {
        const opt = document.createElement("option");
        opt.value = mun;
        opt.textContent = mun;
        municipioFilter.appendChild(opt);
      });
    } catch (err) {
      console.error("Erro ao carregar municípios:", err);
    }
  });
}


  // ---------------------------
  // Render GeoJSON / Mapa
  // ---------------------------
  function renderGeoJSON(geoData, resumoFiltrado) {
  if (window._layerEstados) {
    map.removeLayer(window._layerEstados);
  }

  // --- monta dicionário UF -> total filtrado ---
  const totalByUf = {};
  resumoFiltrado.forEach(r => {
    const uf = (r.Sigla_UF || r.uf || r.sigla || r.Sigla || "").trim();
    totalByUf[uf] = r.total;
  });

  // --- escala de cores ---
  function getColor(value) {
    return value > 100 ? "#00441b" :
           value > 50  ? "#006d2c" :
           value > 20  ? "#238b45" :
           value > 10  ? "#41ab5d" :
           value > 5   ? "#74c476" :
           value > 0   ? "#a1d99b" :
                         "#e5f5e0";
  }

  // --- estilo final ---
  function style(feature) {
    const uf =
      feature.properties.sigla ||
      feature.properties.SIGLA ||
      feature.properties.Sigla ||
      "";

    const total = totalByUf[uf] || 0;

    return {
      fillColor: getColor(total),
      weight: 1,
      opacity: 1,
      color: "white",
      fillOpacity: 0.9
    };
  }

  // --- cria o mapa ---
  window._layerEstados = L.geoJSON(geoData, {
    style: style,
    onEachFeature: onEachFeature
  }).addTo(map);


    //----------
    //card
    //----------
    function onEachFeature(feature, layer) {
  const uf = (feature.properties.sigla || "").toString().toUpperCase();
  const nome = feature.properties.nome || feature.properties.name || uf;

  layer.on("click", async () => {
    try {
      const anoMapa = document.getElementById("mapAnoFilter")?.value || "";

      // ------ 1) Eventos por UF e ANO ------
      const url = `/api/municipios?estado=${encodeURIComponent(uf)}`
                + (anoMapa ? `&ano=${encodeURIComponent(anoMapa)}` : "")
                + "&limit=10000";

      const res = await fetch(url);
      const data = await res.json();
      const rows = data.rows || [];

      const totalEventos = rows.length;
      const municipiosAfetados = new Set(rows.map(r => r.Nome_Municipio)).size;
      const totalFeridos = rows.reduce((acc, r) => acc + (Number(r.DH_FERIDOS) || 0), 0);
      const totalMortos = rows.reduce((acc, r) => acc + (Number(r.DH_MORTOS) || 0), 0);

      // ------ 2) CLIMA DO ESTADO ------
      // usa a capital do estado
      // usa a capital do estado
      const climaRes = await fetch(`/weather?q=${encodeURIComponent(nome)}`);
      let clima = {};
      if (climaRes.ok) {
        clima = await climaRes.json(); 
      }

      const temperatura = clima.main?.temp ? `${clima.main.temp} °C` : "Indisponível";
      const condicao = clima.weather?.length ? clima.weather[0].description : "Indisponível";


      // ------ 3) Monta o card ------
      const cardHTML = `
        <div class="disaster-card">
          <h3>${nome} (${uf}) — Ano ${anoMapa || "Todos"}</h3>

          <div><b>Clima:</b> ${condicao}</div>
          <div><b>Temperatura:</b> ${temperatura}</div>
          <hr>

          <div><b>Total de eventos:</b> ${totalEventos}</div>
          <div><b>Municípios afetados:</b> ${municipiosAfetados}</div>
          <div><b>Feridos:</b> ${totalFeridos}</div>
          <div><b>Mortos:</b> ${totalMortos}</div>
        </div>
      `;

      layer.bindPopup(cardHTML, {
        closeButton: false,
        className: "custom-popup"
      }).openPopup();
    } catch (err) {
      console.error("Erro ao buscar dados do estado:", err);
    }
  });

  layer.bindTooltip(`${nome} (${uf}) — ${totalByUf[uf] || 0} registros`);
}


    geojsonLayer = L.geoJSON(geoData, { style, onEachFeature }).addTo(map);
  }

  // ---------------------------
  // Busca registros com paginação e filtros (usada pela tabela)
  // ---------------------------
  async function fetchRegistros(params = {}) {
    const url = new URL(API_MUNICIPIOS, window.location.origin);

    // adiciona somente os params realmente usados
    for (const k in params) {
      const value = params[k];
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(k, value);
      }
    }

    try {
      const res = await fetch(url);
     if (!res.ok) {
  console.warn("Erro ao buscar registros:", res.status);
  return { rows: [], total: 0 };
}
return await res.json();

    } catch (e) {
      console.error("Erro ao buscar registros:", e);
      return { rows: [], total: 0 };
    }
  }

    // ---------------------------
  // GRÁFICO NOVO — UpdateChart
  // ---------------------------
  async function updateChart(rows) {
  if (!chartInstance) return;

  const estadoVal = estadoFilter?.value || "";
  const municipioVal = municipioFilter?.value || "";
  const anoVal = anoFilter?.value || "";

  let datasetRows = rows;

  // 0 — TODOS selecionados
  if (estadoVal === "" && municipioVal === "" && anoVal === "") {
    const all = await fetchRegistros({ limit: 9999999 });
    datasetRows = all.rows;
  }

  // 1 — Estado selecionado (todos os anos)
  else if (estadoVal !== "" && municipioVal === "" && anoVal === "") {
    const all = await fetchRegistros({
      estado: estadoVal,
      limit: 9999999
    });
    datasetRows = all.rows;
  }

  // 2 — Município selecionado (todos os anos)
  else if (municipioVal !== "") {
    const all = await fetchRegistros({
      cidade: municipioVal,
      limit: 9999999
    });
    datasetRows = all.rows;
  }

  // 3 — Ano selecionado (todos os estados/municípios)
  else if (anoVal !== "") {
    const all = await fetchRegistros({
      ano: anoVal,
      limit: 9999999
    });
    datasetRows = all.rows.length ? all.rows : rows;
  }

  // ---- Agrupa por ano ----
  const eventosPorAno = {};
  datasetRows.forEach(r => {
    const ano = r.Ano || r.ano || r.ANO || (r.Data_Evento ? r.Data_Evento.slice(-4) : "");
    if (!ano) return;
    eventosPorAno[String(ano)] = (eventosPorAno[String(ano)] || 0) + 1;
  });

  let anosOrdenados = Object.keys(eventosPorAno)
    .map(n => Number(n))
    .sort((a, b) => a - b);

  // Regra: se ano selecionado, inclui anos anteriores
  if (anoVal) {
    const alvo = Number(anoVal);
    const minAno = Math.min(...anosOrdenados);
    const completo = [];
    for (let a = minAno; a <= alvo; a++) completo.push(a);
    anosOrdenados = completo;
  }

  anosOrdenados = anosOrdenados.map(String);

  chartInstance.data.labels = anosOrdenados;
  chartInstance.data.datasets[0].data = anosOrdenados.map(a => eventosPorAno[a] || 0);
  chartInstance.update();
  exibirAnalise(
  anosOrdenados,
  chartInstance.data.datasets[0].data,
  datasetRows
);

}

// ---------------------------
// 🔥 NOVO — ANÁLISE AVANÇADA + PREVISÃO 2026
// ---------------------------

// analisa tendência geral (subindo, caindo, estável)
function analisarTendencia(anos, valores) {
  if (anos.length < 2) return { tendencia: "indefinida", direcao: 0 };

  let subida = 0, descida = 0;
  for (let i = 1; i < valores.length; i++) {
    if (valores[i] > valores[i-1]) subida++;
    else if (valores[i] < valores[i-1]) descida++;
  }

  if (subida > descida) return { tendencia: "subindo", direcao: 1 };
  if (descida > subida) return { tendencia: "caindo", direcao: -1 };
  return { tendencia: "estável", direcao: 0 };
}

// regressão linear simples para previsão de 2026
function calcularPrevisao(anos, valores) {
  if (anos.length < 2) return null;

  const n = anos.length;
  const xs = anos.map(Number);
  const ys = valores.map(Number);

  const somaX = xs.reduce((a,b)=>a+b,0);
  const somaY = ys.reduce((a,b)=>a+b,0);
  const somaXY = xs.reduce((a,b,i)=>a + b*ys[i], 0);
  const somaX2 = xs.reduce((a,b)=>a + b*b, 0);

  const m = (n*somaXY - somaX*somaY) / (n*somaX2 - somaX*somaX);
  const b = (somaY - m*somaX) / n;

  const previsaoAno = 2026;  // sempre 2026
  const previsaoValor = Math.max(0, Math.round(m * previsaoAno + b));

  return { ano: previsaoAno, valor: previsaoValor };
}

// calcula variação percentual dos últimos 3 anos
function calcularPercentualAtualizacao(anos, valores) {
  const n = valores.length;
  if (n < 4) return null; // precisa de pelo menos 4 anos para comparar últimos 3 anos

  const ultimos3Anos = valores.slice(n-3);
  const primeiro = ultimos3Anos[0];
  const ultimo = ultimos3Anos[2];

  const perc = primeiro === 0 ? 100 : Math.round(((ultimo - primeiro)/primeiro) * 100);
  return perc;
}

// retorna os 3 estados mais afetados (eventos, feridos, mortos)
function topEstados(rows) {
  const totalPorEstado = {};
  rows.forEach(r => {
    const uf = r.Sigla_UF || r.uf || r.Sigla || "";
    if (!uf) return;
    totalPorEstado[uf] = totalPorEstado[uf] ? {
      eventos: totalPorEstado[uf].eventos + 1,
      feridos: totalPorEstado[uf].feridos + (Number(r.DH_FERIDOS) || 0),
      mortos: totalPorEstado[uf].mortos + (Number(r.DH_MORTOS) || 0)
    } : {
      eventos: 1,
      feridos: Number(r.DH_FERIDOS) || 0,
      mortos: Number(r.DH_MORTOS) || 0
    };
  });

  const arr = Object.entries(totalPorEstado).map(([uf, vals]) => ({ uf, ...vals }));
  arr.sort((a,b) => b.eventos - a.eventos);
  return arr.slice(0,3);
}

// exibe análise detalhada abaixo do gráfico
function exibirAnalise(anos, valores, rows = []) {
  let box = document.getElementById("analiseBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "analiseBox";
    box.style.marginTop = "15px";
    box.style.padding = "12px";
    box.style.background = "#fafafa";
    box.style.borderRadius = "8px";
    box.style.boxShadow = "0 1px 4px rgba(0,0,0,0.15)";
    document.querySelector("#barChart").parentElement.appendChild(box);
  }

  const t = analisarTendencia(anos, valores);
  const p = calcularPrevisao(anos, valores);
  const perc3anos = calcularPercentualAtualizacao(anos, valores);
  const top3 = topEstados(rows);

  let texto =
    `<b>Tendência geral:</b> ${t.tendencia.toUpperCase()}<br>`;

  if (p) {
    texto += `<b>Previsão para 2026:</b> ${p.valor} eventos estimados<br>`;
  }

  if (perc3anos !== null) {
    texto += `<b>Variação últimos 3 anos:</b> ${perc3anos > 0 ? "+" : ""}${perc3anos}%<br>`;
  }

  if (top3.length) {
    texto += `<b>estados mais afetados:</b><br>`;
    top3.forEach(s => {
      const percFeridos = s.feridos ? Math.round((s.feridos/Math.max(1,s.eventos))*100) : 0;
      const percMortos = s.mortos ? Math.round((s.mortos/Math.max(1,s.eventos))*100) : 0;
      texto += `${s.uf}: ${s.eventos} eventos, ${s.feridos} feridos (${percFeridos}%), ${s.mortos} mortos (${percMortos}%)<br>`;
    });
  }

  box.innerHTML = texto;
}

  // ---------------------------
  // Tabela / Gráfico
  // ---------------------------
  function atualizarTabela(data) {
    const tbody = document.querySelector("#disasterTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!data || data.length === 0) {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>Nenhum registro encontrado.</td></tr>";
      return;
    }
    appendToTable(data);
  }

  function appendToTable(rows) {
    const tbody = document.querySelector("#disasterTable tbody");
    rows.forEach(item => {
      const ano = item.Data_Evento ? item.Data_Evento.slice(-4) : "";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ano}</td>
        <td>${item.Nome_Municipio || "—"}</td>
        <td>${item.Sigla_UF || "—"}</td>
        <td style="text-align:left;">${item.descricao_tipologia || "—"}</td>
        <td>${item.grupo_de_desastre || "—"}</td>
        <td>${item.DH_FERIDOS != null ? item.DH_FERIDOS : 0}</td>
        <td>${item.DH_MORTOS != null ? item.DH_MORTOS : 0}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // scroll infinito
  const tableContainer = document.querySelector(".table-container");
  if (tableContainer) {
    tableContainer.addEventListener("scroll", async () => {
      if (loading || allLoaded) return;
      const { scrollTop, scrollHeight, clientHeight } = tableContainer;
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        loading = true;
        currentOffset += PAGE_SIZE;

        const params = {};
        if (estadoFilter && estadoFilter.value) params.estado = estadoFilter.value;
        if (municipioFilter && municipioFilter.value) params.cidade = municipioFilter.value;
        if (anoFilter && anoFilter.value) params.ano = anoFilter.value;
        params.limit = PAGE_SIZE;
        params.offset = currentOffset;

        const data = await fetchRegistros(params);
        if (data.rows.length === 0) {
          allLoaded = true;
        } else {
          appendToTable(data.rows);
        }
        loading = false;
      }
    });
  }

  // ---------------------------
  // Filtros da TABELA (botões)
  // ---------------------------
  if (applyBtn) {
  applyBtn.addEventListener("click", async () => {
    currentOffset = 0; 
    allLoaded = false;

    const estado = estadoFilter ? estadoFilter.value : "";
    const municipio = municipioFilter ? municipioFilter.value : "";
    const ano = anoFilter ? anoFilter.value : "";

    const params = { limit: PAGE_SIZE, offset: currentOffset };
    if (estado) params.estado = estado;
    if (municipio) params.cidade = municipio;
    if (ano) params.ano = ano;

    const registros = await fetchRegistros(params);

    atualizarTabela(registros.rows);

    // 🔥 SOLUCIONA O PROBLEMA DO GRÁFICO
    updateChart(registros.rows);
  });
}


  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (estadoFilter) estadoFilter.value = "";
      if (municipioFilter) municipioFilter.value = "";
      if (anoFilter) anoFilter.value = "";
      currentOffset = 0; allLoaded = false;
      initChart();
updateChart([]);  // limpa
clearBtn.disabled = true;

// recarrega tudo para popular gráfico corretamente
loadAll();

      atualizarTabela(municipiosCache);

    });
  }

  // ---------------------------
  // Filtros do MAPA
  // ---------------------------
  // popula map filters: (caso yearFilter seja o elemento do mapa, ele já foi populado)
  function getSelectedMapYears() {
    // se existir elemento mapAnoElem e for um select <select multiple> use suas opções selecionadas
    if (mapAnoElem) {
      if (mapAnoElem.tagName === "SELECT" && mapAnoElem.multiple) {
        return Array.from(mapAnoElem.selectedOptions).map(o => o.value).filter(Boolean);
      } else if (mapAnoElem.tagName === "SELECT") {
        return mapAnoElem.value ? [mapAnoElem.value] : [];
      }
    }
    return [];
  }

  // Função que agrega registros por UF e filtra o GeoJSON
 // -----------------------------------------------------
// Substitua a função updateMapFilters existente por esta
// -----------------------------------------------------
async function updateMapFilters() {
  const ano = document.getElementById("mapAnoFilter")?.value || "";
  const estado = document.getElementById("mapEstadoFilter")?.value || "";

  // Carrega GeoJSON completo (sempre mantém todos os polígonos)
  const geoRes = await fetch(
    "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson"
  );
  const geoData = await geoRes.json();

  // Pede o resumo já filtrado por ano (se backend aceitar ?ano)
  // Se o seu backend não aceitar ?ano, deixe apenas "/api/estados_resumo" e iremos filtrar aqui.
  let urlResumo = "/api/estados_resumo";
  if (ano) urlResumo += `?ano=${encodeURIComponent(ano)}`;

  const resumoRes = await fetch(urlResumo);
  let resumo = await resumoRes.json();

  // Se backend não suportar ?ano, descomente a linha abaixo para filtrar por ano aqui:
  // if (ano) resumo = resumo.filter(r => String(r.Ano || r.ano || "").trim() === String(ano));

  // Se o usuário escolheu um estado no seletor do mapa, filtramos o resumo para esse estado
  if (estado) {
    resumo = resumo.filter(r => {
      // aceita múltiplos formatos de campo (Sigla_UF, uf, Sigla)
      const sigla = (r.Sigla_UF || r.uf || r.sigla || r.Sigla || "").toString().trim();
      return sigla === estado;
    });
  }

  // --- IMPORTANT: não removemos geoData.features ---
  // Em vez disso, passamos o resumo filtrado para renderGeoJSON.
  // renderGeoJSON vai pintar todos os polígonos, usando 'resumo' para determinar as cores.
  renderGeoJSON(geoData, resumo);
}




  // eventos dos filtros do mapa (anexa onde existir)
  if (mapAnoElem) {
    if (mapAnoElem.tagName === "SELECT") {
      mapAnoElem.addEventListener("change", updateMapFilters);
    }
  }
  if (mapEstadoFilter) mapEstadoFilter.addEventListener("change", updateMapFilters);

  // ---------------------------
  // Inicializa tudo
  // ---------------------------
  async function loadAll() {
  try {
    const filtrosRes = await fetch(API_FILTROS);
    filtrosCache = await filtrosRes.json();
      
    populateFilters(filtrosCache);
    populateMapFilters(filtrosCache);

    const registros = await fetchRegistros({ limit: PAGE_SIZE, offset: 0 });
    municipiosCache = registros.rows || [];

    atualizarTabela(municipiosCache);

    initChart();                 // ← OBRIGATÓRIO
    await updateChart(municipiosCache);


    updateMapFilters();
  } catch (err) {
    console.error("Erro ao carregar dados iniciais:", err);
  }
}


loadAll();
});
