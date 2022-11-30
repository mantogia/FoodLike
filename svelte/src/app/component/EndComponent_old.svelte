<script>
    
    import { foodListe } from '../stores/stores.js';
    let count = foodListe.length;

    

    
</script>

<div class="card">
    <h5 class="card-header">Ihr Fragebogen</h5>
    <div class="card-body">
      <h5 class="card-title">
        
            Der Fragebogen wurde beendet.
       
      </h5>
      <p class="card-text">

            Sie haben alle {count} Fragen beantwortet.

      </p>
      <a href="#/evaluation" class="btn btn-primary">Zur Evaluation</a>
    </div>
  </div>