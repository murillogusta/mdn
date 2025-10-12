let chartInstance = null;

// Espera o carregamento dos dados do mapa
window.addEventListener("dataLoaded", (event) => {
  const allData = event.detail;
  renderChart(allData);
});

// Atualiza o gráfico quando o filtro de ano é alterado
window.addEventListener("yearChanged", (event) => {
  const filteredData = event.detail;
  renderChart(filteredData);
});

function renderChart(data) {
  // Agrupa por ano
  const contagemPorAno = {};
  data.forEach(s => {
    const ano = s.ano;
    if (ano) contagemPorAno[ano] = (contagemPorAno[ano] || 0) + 1;
  });

  const anos = Object.keys(contagemPorAno).sort((a,b) => a-b);
  const quantidades = anos.map(ano => contagemPorAno[ano]);

  const ctx = document.getElementById('barChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: anos,
      datasets: [{
        label: 'Número de eventos',
        data: quantidades,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: {
            font: { size: 18 },
            color: '#333'
          }
        },
        title: {
          display: true,
          text: 'Eventos Naturais por Ano',
          color: '#1a1a1a',
          font: { size: 22 },
          padding: { top: 20, bottom: 20 }
        }
      },
      layout: {
        padding: { top: 30, bottom: 20, left: 30, right: 30 }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Quantidade',
            font: { size: 18 },
            color: '#333'
          },
          ticks: {
            stepSize: 1, // 🔹 Mostra apenas números inteiros
            callback: function(value) {
              if (Number.isInteger(value)) return value;
            },
            font: { size: 14 },
            color: '#555'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Ano',
            font: { size: 18 },
            color: '#333'
          },
          ticks: {
            font: { size: 14 },
            color: '#555',
            maxRotation: 90, // 🔹 Mantém os anos na vertical
            minRotation: 90
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}
