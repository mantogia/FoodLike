<script>
  import RouterLink from './RouterLink.svelte'
</script>

<style>
  nav {
    padding-left: 25%;
    padding-right: 25%;
    
  }

  li {
    display: inline;
    padding: 20px;
    margin: 10px;
    font-weight: bold;
    border-radius: 10px;
    box-shadow: inset 0 0 0 0 #212529;
    color: #212529;
    transition: color .3s ease-in-out, box-shadow .3s ease-in-out;
  }

  li:hover {
    color: #5A93D5;
    box-shadow: inset 200px 0 0 0 #212529;
  }

  ul {
    text-align: center;
  }

  nav ul {
    list-style: none;
  }

  .nav-frame {
    padding-top: 25px;
    background-color: #5A93D5;
    border-color: #5a74d5;
    border-width: 10px;	
    border: solid;
    border-radius: 15px;
  }
</style>

<nav>
  <div class="nav-frame">
    
    <ul >
      <li>
        <RouterLink tag="li" url=''>Homepage</RouterLink>
      </li>

      <li>
        <RouterLink url='questions'>Umfrage</RouterLink>
      </li>

      <li>
        <RouterLink url='evaluation'>Evaluation</RouterLink>
      </li>

    </ul>
  </div>
</nav>