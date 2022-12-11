<script>

export let evaluation;

export let index;

import {onMount} from 'svelte'

function createChart() {
  let ctx = document.getElementById('myChart').getContext('2d');
  let labels = ['Dislikes', 'Likes', 'Superlikes'];
  let colorHex = ['#FB3640', '#43AA8B', '#253D5B'];

  let myChart = new Chart(ctx, {
    type: 'pie',
    data: {
      datasets: [{
        data: [evaluation[4], evaluation[5], evaluation[6]],
        backgroundColor: colorHex
      }],
      labels: labels
    },
    options: {
      responsive: true,
      legend: {
        position: 'bottom'
      },
      plugins: {
        datalabels: {
          color: '#fff',
          anchor: 'end',
          align: 'start',
          offset: -10,
          borderWidth: 2,
          borderColor: '#fff',
          borderRadius: 25,
          backgroundColor: (context) => {
            return context.dataset.backgroundColor;
          },
          font: {
            weight: 'bold',
            size: '10'
          },
          formatter: (value) => {
            return value + ' %';
          }
        }
      }
    }
  })
}

onMount(createChart);

</script>

<div class="accordion-item">
  <h2 class="accordion-header" id="heading{index}">
    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapse{index}" aria-expanded="true" aria-controls="collapseOne">
      <b>Kategorie: {evaluation[0]}</b>
    </button>
  </h2>
  <div id="collapse{index}" class="accordion-collapse collapse" aria-labelledby="heading{index}" data-bs-parent="#accordionExample2">
    <div class="accordion-body">
      <strong>
      <p>Anzahl Ratings in dieser Kategorie: {evaluation[2]}</p>
      </strong> 
      <p>Summe aller Ratings in dieser Kategorie: {evaluation[1]}</p>
      <p>Durchschnittliches Rating in dieser Kategorie: {evaluation[3]}</p>
      <p>Anzahl dislikes: {evaluation[4]}</p>
      <p>Anzahl likes: {evaluation[5]}</p>
      <p>Anzahl superlikes: {evaluation[6]}</p>
      <div class="chart-wrapper">
        <canvas id="myChart"></canvas>
      </div>
    </div>
  </div>
</div>

<style>

  .chart-wrapper {
    width: 500px;
    height: 500px;
    margin: 0 auto;
  }
</style>