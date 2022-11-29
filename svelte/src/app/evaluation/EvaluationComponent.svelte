<script>

export let evaluation;

export let index;


</script>

<div class="accordion-item">
  <h2 class="accordion-header" id="heading{index}">
    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapse{index}" aria-expanded="true" aria-controls="collapseOne">
      {index} Kategorie: {evaluation[0]}
    </button>
  </h2>
  <div id="collapse{index}" class="accordion-collapse collapse" aria-labelledby="heading{index}" data-bs-parent="#accordionExample">
    <div class="accordion-body">
      <strong>
      <p>Anzahl Ratings in dieser Kategorie: {evaluation[2]}</p>
      </strong> 
      <p>Summe aller Ratings in dieser Kategorie: {evaluation[1]}</p>
      <p>Durchschnittliches Rating in dieser Kategorie: {evaluation[3]}</p>
      <p>Anzahl dislikes: {evaluation[4]}</p>
      <p>Anzahl likes: {evaluation[5]}</p>
      <p>Anzahl superlikes: {evaluation[6]}</p>
    </div>
  </div>
</div>
