<script>

    import {onMount} from "svelte";
    import { createEventDispatcher} from "svelte";
  
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

    function delay(milliseconds){
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
    }

    async function init(vote) {

        var element = document.getElementById("card-element");

        if (vote == 0) {
            console.log("dislike!!!")
            element.classList.add("card-element-dislike");
            await delay(1000);
            element.classList.remove("card-element-dislike");
            handleVote(vote);
        } else if (vote == 1) {
            console.log("like!!!")
            element.classList.add("card-element-like");
            await delay(1000);
            element.classList.remove("card-element-like");
            handleVote(vote);
        } else {
            console.log("superlike!!!")
            element.classList.add("card-element-superlike");
            await delay(1000);
            element.classList.remove("card-element-superlike");
            handleVote(vote);
        }
    }

    const handleVote = (vote) => {
        
        console.log(vote)

        dispatch('save-vote', vote);
    }

</script>



<div class="card mx-auto mt-5" id="card-element" style="width: 18rem; text-align: center;">
    <img src="./images/{food_nr}.jpg" class="card-img-top" alt="{food.food_name}">
    <div class="card-body">
    <!-- 
      <button class="btn btn-primary" on:click={() => init(0)}>dislike</button>
      <button class="btn btn-primary" on:click={() => init(1)}>like</button>
      <button class="btn btn-primary" on:click={() => init(2)}>superlike</button>
    -->
      <p><b>{food.food_name}</b></p>
      <img src="./icons/dislike.png" class="dislike" alt="dislike" on:click={() => init(0)}>
      <img src="./icons/like.png" class="like" alt="like" on:click={() => init(1)}>
      <img src="./icons/superlike.png" class="superlike" alt="superlike" on:click={() => init(2)}>
    </div>
</div>


<style>
    .card{
        color: black;
    }

    .dislike{
        width:25%;
        float:left;
        padding-left:5%;
        transition: transform .3s; /* Animation */
    }

    .dislike:hover{
        transform: scale(1.1);
    }

    .like{
        width:20%;
        transition: transform .3s; /* Animation */
    }

    .like:hover{
        transform: scale(1.1);
    }

    .superlike{
        width:25%;
        float:right;
        padding-right:5%;
        transition: transform .3s; /* Animation */
    }

    .superlike:hover{
        transform: scale(1.1);
    }
    
    :global(.card-element-dislike){
        animation: slide-left 1000ms forwards;
    }

    :global(.card-element-like){
        animation: slide-right 1000ms forwards;
    }

    :global(.card-element-superlike){
        animation: slide-superlike 1000ms forwards;
    }
 

    @keyframes slide-right {
        0% {
            transform: translateX(0%);
            opacity: 1;
        }
        99% {
            transform: translateX(100%) rotate(15deg);
            opacity: 0;
        }
        100%{
            transform: translateX(0%);
            opacity: 1;
        }
    }

    @keyframes slide-left {
        0% {
            transform: translateX(0%);
            opacity: 1;
        }
        99% {
            transform: translateX(-100%) rotate(-15deg);
            opacity: 0;
        }
        100%{
            transform: translateX(0%);
            opacity: 1;
        }
    }

    @keyframes slide-superlike {
        0% {
            transform: translateX(0%);
            opacity: 1;
        }
        99% {
            transform: scale(1.7);
            opacity: 0;
        }
        100%{
            transform: translateX(0%);
            opacity: 1;
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