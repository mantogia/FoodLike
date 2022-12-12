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

<div class="card text-center mx-auto">
    <div class="card-header">
        Fragebogen
    </div>
    <div class="card-body">
      <h5 class="card-title">Inhalt</h5>
      <p class="card-text">
        Dieser Fragbogen beinhaltet eine Vielzahl an Lebensmittel. 
        <br>Geben Sie bitte an, ob Sie die einzelne Lebensmittel mögen oder nicht. <br>Unterscheiden können Sie dabei zwischen <b>"dislike"</b>, <b>"like"</b> und <b>"superlike"</b>.
        <br>
      </p>
      <div class="card icons" style="width: 10rem;">
        <img class="card-img-top" src="./icons/dislike.png" alt="Card image cap">
        <div class="card-body">
          <h5 class="card-title text-center">dislike</h5>
          <p class="card-text text-center" >Dieses Lebensmittel mag ich nicht.</p>
        </div>
      </div>
      <div class="card icons" style="width: 10rem;">
        <img class="card-img-top" src="./icons/like.png" alt="Card image cap">
        <div class="card-body">
          <h5 class="card-title text-center">like</h5>
          <p class="card-text text-center" >Dieses Lebensmittel mag ich.</p>
        </div>
      </div>
      <div class="card icons" style="width: 10rem;">
        <img class="card-img-top" src="./icons/superlike.png" alt="Card image cap">
        <div class="card-body">
          <h5 class="card-title text-center">superlike</h5>
          <p class="card-text text-center" >Dieses Lebensmittel mag ich <u>sehr</u>.</p>
        </div>
      </div>
      <p class="card-text">
        <br>
        Mit diesen Angaben wird eine erste Evaluation durchgeführt.
      </p>  
      
      
      <button on:click={createNewFragebogen} class="btn btn-primary">Zur Umfrage</button>
    </div>
  </div>

  <style>

    .card-img-top{
      padding-top: 20px;
      padding-left: 50px;
      padding-right: 50px;
    }

    .icons {
      display:inline-block;
    }
 
  </style>