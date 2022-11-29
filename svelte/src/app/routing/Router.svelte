<script>
  import { hash } from '../services/route.serv'
  import Homepage from '../pages/Homepage.svelte';
  import Notfound from '../pages/Notfound.svelte';
  import Questionspage from '../pages/Questionspage.svelte';
  import Evaluationpage from '../pages/Evaluationpage.svelte';
 
  let value = Notfound;

  hash.subscribe( valu => {
    switch(valu) {
      case '':
        value = Homepage;
        break;
        case 'questions':
        value = Questionspage;
        break;
        case 'evaluation':
        value = Evaluationpage;
        break;
      default:
        value = Notfound;
    }
  });
</script>

<style>
  main {
    flex-grow: 1;
    background-color: #212529;
    color: #00DD95;
    padding: 1rem;
  }



</style>

<main>

  



  <svelte:component this={value}/>
</main>
