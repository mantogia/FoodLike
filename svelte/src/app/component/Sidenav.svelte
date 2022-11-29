<script>
  import RouterLink from './RouterLink.svelte'
</script>

<style>
  nav {
    flex-basis: 10rem;
    background-color: #00DD95;
    color: #212529;
    padding: 1rem; 
  }

  nav ul {
    list-style: none;
  }

  nav ul li {
    padding: .5rem 0;
  }
</style>

<nav>
  <h1>Navigation</h1>
  <ul>

    <li>
      <RouterLink url=''>Homepage</RouterLink>
    </li>

    <li>
      <RouterLink url='questions'>Umfrage</RouterLink>
    </li>

    <li>
      <RouterLink url='evaluation'>Evaluation</RouterLink>
    </li>

  </ul>
</nav>