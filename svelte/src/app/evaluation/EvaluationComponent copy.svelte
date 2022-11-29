<script>   

export let user;

export let evaluation;



</script>

<div class="card border-dark mb-3 r" style="max-width: 18rem;" >
    <h5 class="card-header">Kategorie: {evaluation[0]}</h5>
    <div class="card-body">
      <h5 class="card-title">Anzahl Ratings in dieser Kategorie: {evaluation[2]}</h5>
      <p class="card-text">Summe aller Ratings in dieser Kategorie: {evaluation[1]}</p>
      <p class="card-text">Durchschnittliches Rating in dieser Kategorie: {evaluation[3]}</p>
      <p class="card-text">Anzahl dislikes: {evaluation[4]}</p>
      <p class="card-text">Anzahl likes: {evaluation[5]}</p>
      <p class="card-text">Anzahl superlikes: {evaluation[6]}</p>
    </div>
  </div>

<style>

</style>
<div class="accordion-item">
  <h2 class="accordion-header" id="headingOne">
    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="true" aria-controls="collapseOne">
      Accordion Item #1
    </button>
  </h2>
  <div id="collapseOne" class="accordion-collapse collapse show" aria-labelledby="headingOne" data-bs-parent="#accordionExample">
    <div class="accordion-body">
      <strong>This is the first item's accordion body.</strong> It is shown by default, until the collapse plugin adds the appropriate classes that we use to style each element. These classes control the overall appearance, as well as the showing and hiding via CSS transitions. You can modify any of this with custom CSS or overriding our default variables. It's also worth noting that just about any HTML can go within the <code>.accordion-body</code>, though the transition does limit overflow.
    </div>
  </div>
</div>
