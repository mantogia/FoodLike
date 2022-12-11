<script>
  import ChartComponent from "../component/ChartComponent.svelte";
  import EvaluationComponent from "../evaluation/EvaluationComponent.svelte";
  import {onMount} from "svelte";
  import {admin, ausloggen} from '../stores/stores.js';

  

    let user = JSON.parse(localStorage.current_user);
    let thisUser = user;
    let food = {}
    let foodRating = {}
    let newList = [];
    let category_list = []
    let listEvaluation = []
    let cat_liste = [];

    onMount(()=> {
      getEvaluations(user);
      
    });

    let listNames = [];
    let listAnzeigen = [];

    function getUserNames(){
      axios.get("/users/name")
        .then((response) => {
            console.log(response.data);
            listNames = response.data;
            listAnzeigen = listNames;
        })
        .catch((error) => {
            console.log(error);
        })
    }

    function getEvaluations(u){
      axios.get("/food_ratings/users/" + u.user_id + "/string")
        .then((response) => {
            console.log(response.data);
            listEvaluation = response.data;
            getRatings(u);
        })
        .catch((error) => {
            console.log(error);
        })

        
    }

    function getRatings(u){
      axios.get("/users/" + u.user_id + "/food_ratings")
        .then((response) => {
            console.log(response.data);
            newList = response.data;

            //const newEv = new Evaluation();
            //listEvaluation = [...listEvaluation, newEv];
            getUserNames();
         })
        .catch((error) => {
            console.log(error);
        })
    }
    
    let user_name = "";

  function changeUser(){
      
      axios.get("users/name/" + user_name)
        .then((response) => {
            console.log(response.data);
            thisUser = response.data;
            getData(thisUser);

         })
        .catch((error) => {
            console.log(error);
        })
  }

let adminBool;


admin.subscribe(value => {
  adminBool = value;
	});

console.log(adminBool)
function reset (){
  getEvaluations(user);
  thisUser = user;
}


function listeAnpassen(){
  listAnzeigen = listNames.filter(isBigEnough)
}

function isBigEnough(value) {
  return value.includes(user_name);
}

    /*class Evaluation {

      constructor

      (category, anzahl_0, anzahl_1, anzahl_2, anzahl_total, summe, durchschnitt) 

      { 

        this.category = category;
        this.anzahl_0 = anzahl_0;
        this.anzahl_1 = anzahl_1;
        this.anzahl_2 = anzahl_2;
        this.anzahl_total = anzahl_total;
        this.summe = summe,
        this.durchschnitt = durchschnitt

      }
     
      }*/

  //Suchtabelle einzelne Lebensmittel    
  jQuery(document).ready(function(){
  jQuery("#myInput").on("keyup", function() {
    var value = jQuery(this).val().toLowerCase();
    jQuery("#single-food-table tr").filter(function() {
      jQuery(this).toggle(jQuery(this).text().toLowerCase().indexOf(value) > -1)
    });
  });
  });

  //Tabelle einzelne Lebensmittel sortieren nach Header (Alphabetisch)
  function sortTable(n) {
    var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
    table = document.getElementById("myTable2");
    switching = true;
    // Set the sorting direction to ascending:
    dir = "asc";
    /* Make a loop that will continue until
    no switching has been done: */
    while (switching) {
      // Start by saying: no switching is done:
      switching = false;
      rows = table.rows;
      /* Loop through all table rows (except the
      first, which contains table headers): */
      for (i = 1; i < (rows.length - 1); i++) {
        // Start by saying there should be no switching:
        shouldSwitch = false;
        /* Get the two elements you want to compare,
        one from current row and one from the next: */
        x = rows[i].getElementsByTagName("TD")[n];
        y = rows[i + 1].getElementsByTagName("TD")[n];
        /* Check if the two rows should switch place,
        based on the direction, asc or desc: */
        if (dir == "asc") {
          if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
            // If so, mark as a switch and break the loop:
            shouldSwitch = true;
            break;
          }
        } else if (dir == "desc") {
          if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
            // If so, mark as a switch and break the loop:
            shouldSwitch = true;
            break;
          }
        }
      }
      if (shouldSwitch) {
        /* If a switch has been marked, make the switch
        and mark that a switch has been done: */
        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
        switching = true;
        // Each time a switch is done, increase this count by 1:
        switchcount ++;
      } else {
        /* If no switching has been done AND the direction is "asc",
        set the direction to "desc" and run the while loop again. */
        if (switchcount == 0 && dir == "asc") {
          dir = "desc";
          switching = true;
        }
      }
    }
  }

  //Tabelle einzelne Lebensmittel herunterladen als Excel
  function exportTableToExcel (username) {
      let date = new Date().toJSON();

      jQuery(document).ready(function () {
      jQuery("#myTable2").table2excel({
          filename: "Evaluation_" + username + "_" + date + ".xls"
      });
    });
  }
  func

</script>


<button on:click={ausloggen} class="btn btn-secondary position-absolute top-0 end-0" type="button" >
  Ausloggen
</button>
<div class="mx-auto" style="width: 80%;">
  <h1 class="text-center">Evaluation {thisUser.user_name}</h1>

  {#if adminBool}
  <div class="accordion mb-3" id="accordionPanelsStayOpenExample">
    <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingSearch">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseSearch" aria-expanded="false" aria-controls="panelsStayOpen-collapseTwo">
            Fragebogen suchen
          </button>
        </h2>
        <div id="panelsStayOpen-collapseSearch" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingSearch">
          <div class="accordion-body">

            <form>
                <div class="form-group ">
                  <label for="Username">Benutzername</label>
                  <input on:change={listeAnpassen} placeholder="gesuchter Benutzername" bind:value={user_name} type="String" class="form-control" id="Username" >

                  <select class="form-select form-select-lg mb-3" aria-label=".form-select-lg example">
                    
                    {#each listAnzeigen as name, i}
                    <option value={name}>{name}</option>
                    
                    {/each}
  
                  </select>
                  
                </div>

                  <button on:click={changeUser} type="button" class="btn btn-dark mt-2">Suchen</button>
                  <button on:click={reset} type="button" class="btn btn-dark mt-2">Zurücksetzen</button>
              </form>
            
          </div>
        </div>
      </div>
  </div>
  {/if}



  <div class="accordion" id="accordionExample1">
    <div class="accordion-item">
      <h1 class="accordion-header" id="headingCategories">
        <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseCategories" aria-expanded="true" aria-controls="collapseOne">
          <b>Nach Kategorien</b>
        </button>
      </h1>
      <div id="collapseCategories" class="accordion-collapse collapse" aria-labelledby="headingCategories" data-bs-parent="#accordionExample1">
        <div class="accordion-body">
          <div class="accordion" id="accordionExample2">

            {#each listEvaluation as evaluation, i}

            <EvaluationComponent index={i} evaluation={evaluation}></EvaluationComponent>

            {/each}

          </div>
        </div>
      </div>
    </div>
  </div>
  <br>  
  <div class="accordion" id="accordionExample1">
    <div class="accordion-item">
      <h1 class="accordion-header" id="headingRating">

        <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseRating" aria-expanded="true" aria-controls="collapseOne">
          <b>Nach einzelnen Lebensmitteln</b>
        </button>

      </h1>
      
      <div id="collapseRating" class="accordion-collapse collapse" aria-labelledby="headingRating" data-bs-parent="#accordionExample1">
        <div class="accordion-body">
          
            <button on:click={() => exportTableToExcel(thisUser.user_name)} class="btn btn-success float-right"><i class="fa-regular fa-file-excel"></i> Excel</button>
            <input class="form-control" id="myInput" type="text" placeholder="Suchen nach Name, Kategorie oder Bewertung...">
            <table class="table" id="myTable2">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col" on:click={() => sortTable(1)}>Name <i class="fa-solid fa-sort"></i></th>
                  <th scope="col" on:click={() => sortTable(2)}>Kategorie <i class="fa-solid fa-sort"></i></th>
                  <th scope="col" on:click={() => sortTable(3)}>Bewertung <i class="fa-solid fa-sort"></i></th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody id="single-food-table">
                {#each newList as foodRating}
                    <tr>
                      <td><b>{foodRating.id}</b></td>
                      <td>{foodRating.food.food_name}</td> 
                      <td>{foodRating.food.category}</td> 
                      <td>
                      {#if foodRating.rating == 0}
                        Dislike
                      {:else if foodRating.rating == 1}
                        Liked
                      {:else}
                        Superlike
                      {/if}
                      </td>
                      <td><img src="./evaluation/{foodRating.rating}.png" class="bewertung" alt="bewertung"></td> 
                  </tr>
              {/each}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .btn {
    margin-top: 1.0rem !important;
    margin-right: 1.0rem !important;
  }

  .bewertung {
    height: 40px;
  }

  th {
  cursor: pointer;
  }
</style>
  
