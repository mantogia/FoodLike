<script>
export let user;

async function createNewFragebogen(){
  axios.get("/users/" + user.user_id + "/fragebogen")
          .then((response) => {
            console.log(response.data);

            switchUrl();
          })
          .catch((error) => {
              console.log(error);
          })
}

function switchUrl(){
  
  const url= "http://localhost:8082/#/questions";
  window.location = url;

}
 

</script>

<div class="card">
    <div class="card-header">
        Fragebogen
    </div>
    <div class="card-body">
      <h5 class="card-title">Inhalt</h5>
      <p class="card-text">
        
        Dieser Fragbogen beinhaltet eine vielzahl an Lebensmittel. 
        Geben Sie bitte an, ob Sie die einzelne Lebensmittel mögen oder nicht. Unterscheiden können Sie dabei zwischen "dislike", "like" und "superlike".
        <br><br>
        <b>dislike</b> = dieses Lebensmittel mag ich nicht.<br>
        <b>like</b> = dieses Lebensmittel mag ich.<br>
        <b>superlike</b> = dieses Lebensmittel mag ich <u>sehr</u>.
        <br><br>
        Mit diesen Angaben wird eine erste Evaluation durchgeführt.
        
      </p>
      <button on:click={createNewFragebogen} class="btn btn-primary">Zur Umfrage</button>
    </div>
  </div>

  <style>

    

  </style>