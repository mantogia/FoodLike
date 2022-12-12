<script>



export let evaluation;

export let index;

import {onMount} from 'svelte'

function createChart() {
  let ctx = document.getElementById('myChart' + index).getContext('2d');
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
let bgOpacity = evaluation[7] / 100;
$: color = evaluation[7] < 50 ? '#000' : '#000';

</script>

<div class="accordion-item">
  <h2 class="accordion-header" id="heading{index}">
    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapse{index}" aria-expanded="true" aria-controls="collapseOne">
      <b>Kategorie: {evaluation[0]}</b>

      <div class="num-display" style="color: {color}; --opacity: {bgOpacity};">

       {evaluation[7]}%

    </div>
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
        <canvas id="myChart{index}"></canvas>
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

  .num-display {
      position: absolute;
      top: -25px;
      right: -25px;
      width: 50px;
      height: 50px;
      
      background: rgba(62, 255, 0, var(--opacity));

      color: #fff;
      border: 1px #eee solid;
      border-radius: 50%;
      padding: 10px;
      text-align: center;
      font-size: 19px;
    }
</style>