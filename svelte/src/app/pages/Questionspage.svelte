<script>
  import { onMount } from 'svelte';
  import EndComponent from '../component/EndComponent.svelte';
  import FoodComponent from '../component/FoodComponent.svelte';
  import { admin } from '../stores/stores.js';
  import {resetPage} from '../stores/stores.js';
  import {ausloggen} from '../stores/stores.js';
  let endOfList = false;

  let food = {};
  let user = JSON.parse(localStorage.current_user);
  let rating;
  let fragebogen_nr = 1;
  let anzahlEmpty = 0;
  let newList = [];
  let index = -1;
  let food_nr = 1;
  let indexList = [];

  let begin = getInformation();


  async function  getInformation(){
    axios.get("/users/" + user.user_id + "/food_ratings")
        .then((response) => {
            newList = response.data
            for (let fr in newList) {

              if (newList[fr].rating == 99){
                anzahlEmpty = anzahlEmpty + 1
                indexList = [...indexList, newList[fr].food.food_id]
              }
            }
            if(anzahlEmpty == 0){
              endOfList = true;
            }else{
              endOfList = false;
              console.log(anzahlEmpty)
              nextFood();
            }
            return anzahlEmpty
        })
        .catch((error) => {
            console.log(error);

            return 0
        })

  };

  const saveRelation = (e) => {
    rating = e.detail;
    axios.post("/food_ratings/" + user.user_id +"/"+ food.food_id +"/"+ fragebogen_nr +"/"+ rating)
          .then((response) => {
            console.log(response.data);
            nextFood();
          })
          .catch((error) => {
              console.log(error);
          })
  };

  const nextFood = () =>{
    index = index + 1;

    if (index < anzahlEmpty){
      
      food_nr = indexList[index]
    } else{
      endOfList = true;
    }

  };


</script>


<button on:click={ausloggen} class="btn btn-secondary position-absolute top-0 end-0" type="button">
  Ausloggen
</button>


<h1 class="text-center mx-auto">Fragebogen</h1>

	{#if !endOfList}
    <FoodComponent food_nr={food_nr} on:save-vote={saveRelation} onChange={newFood => food = newFood} />
  {:else}
    <EndComponent ></EndComponent>
  {/if}




<style>
  h1 {
    display: flex; /* or grid */
    justify-content: center;
    align-items: center;
    width: 50%;
  }

  
  .btn {
    margin-top: 1.0rem !important;
    margin-right: 1.0rem !important;
  }

  
</style>