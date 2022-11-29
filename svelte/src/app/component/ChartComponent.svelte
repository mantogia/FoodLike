<script>


import {onMount} from "svelte";


let xValues = ["Italy", "France", "Spain", "USA", "Argentina"];
let yValues = [55, 49, 44, 24, 15];
let barColors = ["red", "green","blue","orange","brown"];



onMount(()=> {
    createChart();
});

function setChart(){

    myChart.data.labels = xValues;
    myChart.data.datasets[0].data = yValues;
    myChart.data.datasets[0].backgroundColor = barColors;

    myChart.update(); 
}


var myChart;
function createChart(){
    let ctx = document.getElementById('myChart') 
    myChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: [],
            datasets:[{
                label: "Test",
                data: [],
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255,99,132,1)' ,
                borderWidth: 1
            }]
        },
        options: {scales: {yAxes: [{ticks: {beginAtZero: true}}]}}
    });

    setChart();
}


</script>

Hello

<canvas id="myChart" height="400" width="400"></canvas>*/
