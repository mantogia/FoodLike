<script>

  import { onMount } from 'svelte';
  import EndComponent from '../component/EndComponent.svelte';
  import FoodComponent from '../component/FoodComponent.svelte';
  import { admin } from '../stores/stores.js';
  import {resetPage} from '../stores/stores.js';

  let endOfList = false;
  let maxIndex =  foodListe.length -1;
  let index = -1;
  let food = {};
  let user = JSON.parse(localStorage.current_user);
  let foodRating = {

    rating: null,
    food: null,
    user: null,
    fragebogen: null

  };

  let newList = [];

  let promise = getInformation();


  async function getFragobogen(){
    axios.get("/users/" + user.user_id + "/food_ratings/")
        .then((response) => {
            response.data;
            console.log(response.data);

        })
        .catch((error) => {
            console.log(error);

        })

  };


  async function  getInformation(){
    axios.get("/users/" + user.user_id + "/food_ratings")
        .then((response) => {
            newList = response.data;
            console.log(newList);
            if (newList.length >= (maxIndex + 1)){
              endOfList = true;
            }else{
              endOfList = false;
              index = newList.length - 1;
              nextFood(); 
              
            }    
            return "1";
        })
        .catch((error) => {
            console.log(error);
            return "0";
        })

  };

 // onMount(() => getInformation())
 

  /*const saveRelation = (e) => {
    foodRating.user = user;
    foodRating.food = food;
    foodRating.rating = e.detail;
    axios.post("/food_ratings/new/" + foodRating.user.user_id + "/" + foodRating.food.food_id + "/" + foodRating.rating + "/" + foodRating.fragebogen)
          .then((response) => {
            console.log(response.data);
            nextFood();
          })
          .catch((error) => {
              console.log(error);
          })
  };*/

  const saveRelation = (e) => {
    foodRating.user = user;
    foodRating.food = food;
    foodRating.rating = e.detail;
    axios.put("/food_ratings/" + user.user_id +"/"+ food.food_id +"/"+ fragebogen_nr +"/"+ rating)
          .then((response) => {
            console.log(response.data);
            nextFood();
          })
          .catch((error) => {
              console.log(error);
          })
  }

  const nextFood = () =>{
    index = index + 1;

    if (index < maxIndex + 1){
      
      food_nr = foodListe[index];
      
    } else{
      endOfList = true;
    }

  } 

</script>

<h1>Fragebogen</h1>
{#await getInformation}
	<p>...waiting</p>
{:then}
	{#if !endOfList}
    <FoodComponent food_nr={food_nr} on:save-vote={saveRelation} onChange={newFood => food = newFood} />
  {:else}
    <EndComponent ></EndComponent>
  {/if}
{/await}

<style>
  h1 {
    display: flex; /* or grid */
    justify-content: center;
    align-items: center;
  }
</style>