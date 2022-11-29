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

let adminBool = admin;

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

    




</script>

<button on:click={ausloggen} class="btn btn-secondary position-absolute top-0 end-0" type="button" >
  Ausloggen
</button>

<h1>Evaluation {thisUser.user_name}</h1>

{#if adminBool}

<div class="accordion mb-3" id="accordionPanelsStayOpenExample">
  <div class="accordion-item">
      <h2 class="accordion-header" id="panelsStayOpen-headingSearch">
        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseSearch" aria-expanded="false" aria-controls="panelsStayOpen-collapseTwo">
          Frgabogen suchen
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


<div class="accordion" id="accordionExample">
{#each listEvaluation as evaluation, i}

<EvaluationComponent index={i} evaluation={evaluation}></EvaluationComponent>

{/each}





  <div class="accordion-item">
    <h2 class="accordion-header" id="headingRating">
      <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseRating" aria-expanded="true" aria-controls="collapseOne">
        <h1>Ratings</h1>
      </button>
    </h2>
    <div id="collapseRating" class="accordion-collapse collapse" aria-labelledby="headingRating" data-bs-parent="#accordionExample">
      <div class="accordion-body">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Name</th>
                <th scope="col">Category</th>
                <th scope="col">Rating</th>
              </tr>
            </thead>
            <tbody>
              {#each newList as foodRating}
                <tr>
                    <th scope="row">{foodRating.id}</th>
                    <td>{foodRating.food.food_name}</td> 
                    <td>{foodRating.food.category}</td> 
                    <td>{foodRating.rating}</td> 
                </tr>
             {/each}
            </tbody>
          </table>
      </div>
    </div>
  </div>

</div>



<style>
  .btn {
    margin-top: 1.0rem !important;
    margin-right: 1.0rem !important;
  }
</style>
  
