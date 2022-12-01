<script>

    import {onMount} from "svelte";
    import { createEventDispatcher} from "svelte";
    import { quintOut } from "svelte/easing";

    import { fade, blur, fly, slide, scale } from "svelte/transition";
  
    const dispatch = createEventDispatcher();

    export let food_nr;
    $: food_nr && update();

    let food = {};
    export let onChange
    $: onChange(food)
    
    onMount(() => update());

    function update(){
        axios.get("/foods/" + food_nr)
        .then((response) => {
            //console.log(response.data);
            food = response.data;
        })
        .catch((error) => {
            console.log(error);
        })
    }

    const handleVote = (vote) => {
        
        console.log(vote)

        dispatch('save-vote', vote);

        if (vote == 0) {
            console.log("dislike!!!")
            cardleft();
        } else if (vote == 1) {
            console.log("like!!!")
        } else {
            console.log("superlike!!!")
        }
    }

    function cardleft() {
        css: () => 'animation: fade-in 1000ms forwards;'
    }

</script>



<div in:scale out:fade class="card mx-auto mt-5" id="card-element" style="width: 18rem; text-align: center;">
    <img src="./images/{food_nr}.jpg" class="card-img-top" alt="{food.food_name}">
    <div class="card-body">
        
      <button class="btn btn-primary" id="dislike" on:click={() => handleVote(0)}>dislike</button>
      <button class="btn btn-primary" id="like" on:click={() => handleVote(1)}>like</button>
      <button class="btn btn-primary" id="superlike" on:click={() => handleVote(2)}>superlike</button>
    </div>
</div>


<style>
    .card{
        color: black;
    }

    #card-element{
        animation: fade-in 1000ms forwards;
    }


    @keyframes slide-up {
        0% {
            transform: translateY(100%);
        }
        100% {
            transform: translateY(0%);
        }
    }

    @keyframes fade-in {
        0% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
    }
</style>