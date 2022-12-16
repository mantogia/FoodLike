<script>

    import {onMount} from "svelte";
    import { createEventDispatcher} from "svelte";
  
    const dispatch = createEventDispatcher();

    export let food_nr;
    $: food_nr && update();

    let food = {};
    export let onChange
    $: onChange(food)

    export let index;
    export let länge;
    
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
        var element2 = document.getElementById("superlike");

        if (vote == 0) {
            console.log("dislike!!!")
            element.classList.add("card-element-dislike");
            await delay(800);
            element.classList.remove("card-element-dislike");
            element.classList.add("card-element-hide");
            handleVote(vote);
        } else if (vote == 1) {
            console.log("like!!!")
            element.classList.add("card-element-like");
            await delay(800);
            element.classList.remove("card-element-like");
            element.classList.add("card-element-hide");
            handleVote(vote);
        } else {
            console.log("superlike!!!")
            element2.classList.add("icon-superlike");
            await delay(400);
            element.classList.add("card-element-superlike");
            await delay(800);
            element.classList.remove("card-element-superlike");
            element2.classList.remove("icon-superlike");
            element.classList.add("card-element-hide");
            handleVote(vote);
        }
        element.classList.remove("card-element-hide");
        element.classList.add("card-element-fade-in");
        await delay(500);
        element.classList.remove("card-element-fade-in");
    }

    const handleVote = (vote) => {
        
        console.log(vote)

        dispatch('save-vote', vote);
    }


</script>



<div class="card mx-auto mt-5" id="card-element" style="width: 18rem; text-align: center;">
    <img src="./images/{food_nr}.jpg" onerror="this.src='images/alt.jpg'" class="card-img-top" alt="food">
    <div class="card-body">
    <!-- 
      <button class="btn btn-primary" on:click={() => init(0)}>dislike</button>
      <button class="btn btn-primary" on:click={() => init(1)}>like</button>
      <button class="btn btn-primary" on:click={() => init(2)}>superlike</button>
    -->
      <p><b>{food.food_name}</b></p>
      <img src="./icons/dislike.png" class="dislike" alt="dislike" on:click={() => init(0)}>
      <img src="./icons/like.png" class="like" alt="like" on:click={() => init(1)}>
      <img src="./icons/superlike.png" class="superlike" id="superlike" alt="superlike" on:click={() => init(2)}>
    </div>

    <p>{index} von {länge}</p>
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
        animation: slide-left 800ms forwards;
    }

    :global(.card-element-like){
        animation: slide-right 800ms forwards;
    }

    :global(.card-element-superlike){
        animation: slide-superlike 800ms forwards;
    }

    :global(.card-element-fade-in){
        animation: fade-in 400ms forwards;
    }

    :global(.card-element-hide){
        opacity: 0;
    }

    :global(.icon-superlike){
        animation: icon-superlike 800ms forwards;
    }
 

    @keyframes slide-right {
        0% {
            transform: translateX(0%);
            opacity: 1;
        }
        100% {
            transform: translateX(100%) rotate(15deg);
            opacity: 0;
        }
    }

    @keyframes slide-left {
        0% {
            transform: translateX(0%);
            opacity: 1;
        }
        100% {
            transform: translateX(-100%) rotate(-15deg);
            opacity: 0;
        }
    }

    @keyframes slide-superlike {
        0% {
            transform: translateX(0%);
            opacity: 1;
        }
        100% {
            transform: translateY(-5%);
            opacity: 0;
        }
    }

    @keyframes fade-in {
        0% {
            opacity: 0;
            transform: scale(0.6);
        }
        100% {
            opacity: 1;
            transform: scale(1);
        }
    }

    @keyframes icon-superlike {
        50% {
            transform: translateY(-12rem) scale(1) rotate(25deg);
        }
        100% {
            transform: translateY(-12rem) scale(4) rotate(25deg);
        }
    }

</style>