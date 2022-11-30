<script>  

let allergie1;
let allergie2;
let allergie3;
let allergie4;
let allergie5;


function saveAngaben(){

  axios.post("")
}


</script>

<div class="card mb-3">
  <div class="card-header">
    Ihre Angaben
  </div>
  <div class="card-body">
    <p>Geben Sie bitte an, ob Sie über einzelne 
      <u>Allergien/Unverträglichkeiten/Präferenzen</u> verfügen. Die Angaben werden benutzt, damit der Fragebogen auf Sie zugeschnitten werden kann. </p>
    <div class="form-check form-switch">
        <input bind:value={allergie1} class="form-check-input" type="checkbox" role="switch" id="allergie1">
        <label class="form-check-label" for="allergie1">Allergie 1 </label>
      </div>

      <div class="form-check form-switch">
        <input bind:value={allergie2} class="form-check-input" type="checkbox" role="switch" id="allergie2">
        <label class="form-check-label" for="allergie2">Allergie 2</label>
      </div>

      <div class="form-check form-switch">
        <input bind:value={allergie3} class="form-check-input" type="checkbox" role="switch" id="allergie3">
        <label class="form-check-label" for="allergie3">Allergie 3</label>
      </div>
      
      <div class="form-check form-switch">
        <input bind:value={allergie4} class="form-check-input" type="checkbox" role="switch" id="allergie4">
        <label class="form-check-label" for="allergie4">Allergie 4</label>
      </div>

      <div class="form-check form-switch">
        <input bind:value={allergie5} class="form-check-input" type="checkbox" role="switch" id="allergie5">
        <label class="form-check-label" for="allergie5">Allergie 5</label>
      </div>
      <p class="card-text">Wenn Sie alle Fragen beantwortet haben, können Sie auf <b>Sichern</b> drücken. Ihre Angaben sind vorerst nicht anpassbar.</p>
      <button on:click={saveAngaben} class="btn btn-primary">Sichern</button>
    </div>



</div>

