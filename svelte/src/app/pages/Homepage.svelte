<script>
  import { onMount } from 'svelte';
  import FoodComponent from '../component/FoodComponent.svelte';
  import FormComponent from '../component/FormComponent.svelte';
  import LoginComponent from '../component/LoginComponent.svelte';
  import RouterLink from '../component/RouterLink.svelte';
  import StartComponent from '../component/StartComponent.svelte';
  import UserInfos from '../component/UserInfos.svelte';
  import { admin } from '../stores/stores.js';
  import {resetPage} from '../stores/stores.js';
  import {ausloggen} from '../stores/stores.js';
  let neu = true;
  let text = "Bereits ein Konto?"
 

  function btnHandler(){
  neu = !neu;

  if (neu){
    text = "Bereits ein Konto?"
  }else{
    text = "Noch kein Konto?"
  }
  }

//let loggedIn = false;
let loggedIn = localStorage.current_user != null;
$: loggedIn = localStorage.current_user != null;
$: loggedIn && adminReset();

function adminReset(){
  if (!loggedIn){
    admin.set(false);
    console.log(loggedIn)
  } else{
    user = JSON.parse(localStorage.current_user)
  }
}

function switchUrl(){
  if (loggedIn){
  const url= "http://localhost:8082/#/questions";
  window.location = url;

  }
}

let user = {}

function einloggen(){
  loggedIn = true;
  if (JSON.parse(localStorage.current_user).user_id == 1){
    setAdmin();
  }
  user = JSON.parse(localStorage.current_user)
}

function setAdmin() {

	admin.set(true);

}



let infosDone = false;

if (loggedIn){

  infosDone = getInfos();
}


let tempUser = {};
function getInfos(){
  user = JSON.parse(localStorage.current_user)
  axios.get("/users/" + user.user_id)
          .then((response) => {
            
            console.log(response.data);
            tempUser = response.data;
            if(tempUser.angaben == true){
              infosDone = true;
            }
          })
          .catch((error) => {
              console.log(error);
          })

}

function setInfos(){
  infosDone = true;
}

</script>

<h1>FoodLike</h1>

{#if !loggedIn}
  {#if neu}
  <FormComponent on:logIn={einloggen}/>

  {:else}

  <LoginComponent  on:logIn={einloggen}/>

  {/if}

  <button style="margin-top:1.0em ;" type="button" on:click={btnHandler} class="btn btn-secondary mb-3" >{text}</button>

{:else}
  
  <button on:click={ausloggen} class="btn btn-secondary position-absolute top-0 end-0" type="button">
    Ausloggen
  </button>

  {#if !infosDone}
    <UserInfos on:save-Infos={setInfos} ></UserInfos>
  {:else}
    <StartComponent user ={user}/>
  {/if}


{/if}


<style>

.btn {
    
    margin-right: 1.0rem !important;
    margin-top: 1.0rem !important;
  }

</style>