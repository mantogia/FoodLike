<script>

export let evaluation;

export let index;

import {onMount} from 'svelte'

//Pie-Chart
function createChart() {
  let ctx = document.getElementById('myChart' + index).getContext('2d');
  let labels = ['Dislikes', 'Likes', 'Superlikes'];
  let colorHex = ['#F44133', '#00DE96', '#37B7FD'];

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
      title: {
                display: true,
                text: evaluation[0] 
      },
      legend: {
        position: 'bottom'
      },
      animation: {
        onComplete: function () {
          console.log(myChart.toBase64Image());
        },
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


//Bar-Chart
function createChart2() {
  let ctx = document.getElementById('myChart2' + index).getContext('2d');
  let labels = ['Dislikes', 'Likes', 'Superlikes'];
  let colordislike = ['#F44133'];
  let colorlike = ['#00DE96'];
  let colorsuperlike = ['#37B7FD'];

  let myChart = new Chart(ctx, {
    type: 'bar',
    data: {
      datasets: [{
        label: 'Dislikes',
        data: [evaluation[4]],
        backgroundColor: colordislike
      },
      {
        label: 'Likes',
        data: [evaluation[5]],
        backgroundColor: colorlike
      },
      {
        label: 'Superlikes',
        data: [evaluation[6]],
        backgroundColor: colorsuperlike
      }],
      
    },
    options: {
      responsive: true,
      title: {
                display: true,
                text: evaluation[0] 
      },
      scales: {
        yAxes: [{
            ticks: {
                beginAtZero: true
            }
        }]
      },
      legend: {
         position: 'bottom'
      },
      animation: {
        onComplete: function () {
          console.log(myChart.toBase64Image());
        },
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
onMount(createChart2);


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
      <div class="p-category">
        <strong>
        <p>Anzahl Bewertungen in dieser Kategorie: {evaluation[2]}</p>
        </strong> 
        <p class="p-category">Anzahl dislikes: {evaluation[4]}</p>
        <p class="p-category">Anzahl likes: {evaluation[5]}</p>
        <p class="p-category">Anzahl superlikes: {evaluation[6]}</p><br>
        <p class="p-category">Gewichtete Auswertung der Bewertungen in dieser Kategorie: {evaluation[1]}</p>
        <p class=comment><i><b>Kommentar:</b> die gewichtete Auswertung wird folgendermassen berechnet = Anzahl Dislikes * 0 + Anzahl Likes * 1 + Anzahl Superlikes * 2</i></p>
        <p class="p-category">Durchschnittliches Rating in dieser Kategorie: {evaluation[3]}</p>
        <p class=comment><i><b>Kommentar:</b> das durchschnittliche Rating wird folgendermassen berechnet = Gewichtete Auswertung / Anzahl Bewertungen</i></p> 
      </div>
      <hr> 
        <p class="p-category"><b>Säulendiagramm der Kategorie: {evaluation[0]}</b></p>
        <p class=comment><i><b>Tipp:</b> Rechtsklick ➔ Bild speichern unter...</i></p> 
        <div class="chart-wrapper">
          <canvas id="myChart2{index}"></canvas>
        </div>
      <hr> 
        <p class="p-category"><b>Kreisdiagramm der Kategorie: {evaluation[0]}</b></p>
        <p class=comment><i><b>Tipp:</b> Rechtsklick ➔ Bild speichern unter...</i></p> 
        <div class="chart-wrapper">
          <canvas id="myChart{index}"></canvas>
        </div>
    </div>
  </div>
</div>

<style>

  .chart-wrapper {
      width: 50%;
    
  }

  .num-display {
      position: absolute;
      top: -25px;
      right: -25px;
      width: 50px;
      height: 50px;
      
      background: rgba(0, 62, 255, var(--opacity));

      color: #fff;
      border: 1px #eee solid;
      border-radius: 50%;
      padding: 10px;
      text-align: center;
      font-size: 18px;
    }

    .p-category {
	    margin-bottom: 0; 
    }

    .comment {
      font-size: 16px;
      color:grey;
      margin-top: 0; 		
    }

</style>