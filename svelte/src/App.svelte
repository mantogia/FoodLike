<script>
	import Router from './app/routing/Router.svelte';
	import Sidenav from './app/component/Sidenav.svelte';
  import { admin } from './app/stores/stores.js';

  let adminRigths;

  admin.subscribe(value => {
		adminRigths = value;
	});

</script>

<style>

</style>




<div class="app-shell">
  
  {#if adminRigths}
    <Sidenav class="sidenav" />
  {/if}
  <Router />
</div>