<script>  
let user =  JSON.parse(localStorage.current_user);
let allergie1;
let allergie2;
let allergie3;
let allergie4;
let allergie5;
let allergie6;
let allergie7;
let allergie8;
let allergie9;
let allergie10;
let allergie11;
let allergie12;
let vegetarisch;

let list = []

import { createEventDispatcher} from "svelte";
const dispatch = createEventDispatcher();

function saveAngaben(){

  if(allergie1){list = [... list, "Ei"]};
  if(allergie2){list = [... list, "Erdnuss"]};
  if(allergie3){list = [... list, "Fisch"]};
  if(allergie4){list = [... list, "Krustentiere"]};
  if(allergie5){list = [... list, "Kuhmilch"]};
  if(allergie6){list = [... list, "Schalenfrüchte"]};
  if(allergie7){list = [... list, "Sellerie"]};
  if(allergie8){list = [... list, "Senf"]};
  if(allergie9){list = [... list, "Sesamsamen"]};
  if(allergie10){list = [... list, "Sojabohnen"]};
  if(allergie11){list = [... list, "Weichtiere"]};
  if(allergie12){list = [... list, "Weizen (Gluten)"]};
  if(vegetarisch){
    
    axios.post("/users/" + user.user_id + "/vegetarisch")
          .then((response) => {
            console.log(response.data);
          })
          .catch((error) => {
              console.log(error);
          })
  };

  if (list.length > 0){
    axios.post("/users/" + user.user_id + "/allergien", list)
          .then((response) => {
            console.log(response.data);
          })
          .catch((error) => {
              console.log(error);
          })
  }

  axios.post("/users/" + user.user_id + "/angaben")
          .then((response) => {
            console.log(response.data);
          })
          .catch((error) => {
              console.log(error);
          })

 
  dispatch("save-Infos")
  console.log(list);
}


</script>

<div class="card mb-3">
  <div class="card-header">
    <b>Ihre Angaben</b>
  </div>
  <div class="card-body">
    <p>Bitte geben Sie an, ob Sie über einzelne <b>Allergien oder Unverträglichkeiten</b> verfügen. <br>
      Die Angaben sind notwendig, damit der Fragebogen auf Sie zugeschnitten werden kann.</p>
    
      <div class="form-check form-switch">
        <input bind:checked={allergie1} class="form-check-input" type="checkbox" role="switch" id="allergie1">
        <label class="form-check-label" for="allergie1">Ei </label>
      </div>

      <div class="form-check form-switch">
        <input bind:checked={allergie2} class="form-check-input" type="checkbox" role="switch" id="allergie2">
        <label class="form-check-label" for="allergie2">Erdnuss</label>
      </div>

      <div class="form-check form-switch">
        <input bind:checked={allergie3} class="form-check-input" type="checkbox" role="switch" id="allergie3">
        <label class="form-check-label" for="allergie3">Fisch</label>
      </div>
      
      <div class="form-check form-switch">
        <input bind:checked={allergie4} class="form-check-input" type="checkbox" role="switch" id="allergie4">
        <label class="form-check-label" for="allergie4">Krustentiere</label>
      </div>

      <div class="form-check form-switch">
        <input bind:checked={allergie5} class="form-check-input" type="checkbox" role="switch" id="allergie5">
        <label class="form-check-label" for="allergie5">Kuhmilch</label>
      </div>
      <div class="form-check form-switch">
        <input bind:checked={allergie6} class="form-check-input" type="checkbox" role="switch" id="allergie6">
        <label class="form-check-label" for="allergie6">Schalenfrüchte</label>
      </div>
      <div class="form-check form-switch">
        <input bind:checked={allergie7} class="form-check-input" type="checkbox" role="switch" id="allergie7">
        <label class="form-check-label" for="allergie7">Sellerie</label>
      </div>
      <div class="form-check form-switch">
        <input bind:checked={allergie8} class="form-check-input" type="checkbox" role="switch" id="allergie8">
        <label class="form-check-label" for="allergie8">Senf</label>
      </div>
      <div class="form-check form-switch">
        <input bind:checked={allergie9} class="form-check-input" type="checkbox" role="switch" id="allergie9">
        <label class="form-check-label" for="allergie9">Sesamsamen</label>
      </div>
      <div class="form-check form-switch">
        <input bind:checked={allergie10} class="form-check-input" type="checkbox" role="switch" id="allergie10">
        <label class="form-check-label" for="allergie10">Sojabohnen</label>
      </div>
      <div class="form-check form-switch">
        <input bind:checked={allergie11} class="form-check-input" type="checkbox" role="switch" id="allergie11">
        <label class="form-check-label" for="allergie11">Weichtiere</label>
      </div>
      <div class="form-check form-switch">
        <input bind:checked={allergie12} class="form-check-input" type="checkbox" role="switch" id="allergie12">
        <label class="form-check-label" for="allergie12">Weizen (Gluten)</label>
      </div>
      <br>
      <p>Ernähren Sie sich <u>ausschliesslich</u> vegetarisch?</p>
      <div class="form-check form-switch">
        <input bind:checked={vegetarisch} class="form-check-input" type="checkbox" role="switch" id="vegetarisch">
        <label class="form-check-label" for="vegetarisch">Vegetarisch</label>
      </div>
      <br>

      <p class="card-text">Wenn Sie alle Fragen beantwortet haben, können Sie auf <b>Sichern</b> drücken.</p>
      <button on:click={saveAngaben} class="btn btn-primary">Sichern</button>
    </div>



</div>

