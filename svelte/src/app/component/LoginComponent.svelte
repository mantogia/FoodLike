<script>

    import { createEventDispatcher} from "svelte";
    const dispatch = createEventDispatcher();

    let user = {
        user_name: "",
        user_email: "",
        user_password: "",
        food_ratings: []
    }
    
    let minLength = 4;
    
    let check_username = false;
    
    function checkUsername(){
        if(user.user_name.length >= minLength){
            check_username = true;
            check();
        } else{
            check_username = false;
        }
    
    }
    
    
    let check_password = false;
    
    function checkPassword(){
        let password = user.user_password
    
        let test = hasNumbers(password);
        if(password.length >= minLength && test){
            check_password = true;
            check();
    
        } else{
            check_password = false;
        }
    
    }
    
    function hasNumbers(t)
        {
        var regex = /\d/g;
        return regex.test(t);
    }   
    
    
    let disabled = !(check_password && check_username);
    
    function check(){
    
        disabled = !(check_password && check_username)
    }
    
    
    function checkAccount(){

        axios.get("users/name/" + user.user_name)
            .then((response) => {
            console.log(response.data);
            const pw = response.data.user_password
            if(pw.localeCompare(user.user_password) == 0){

                localStorage.current_user = JSON.stringify(response.data);
                console.log(localStorage.current_user)
                console.log(JSON.parse(localStorage.current_user).user_name)
                console.log("localStorage gespeichert")
                dispatch("logIn", response.data)
                
            } else{

                console.log("Username or Password is invalid")
                
            }

            })
            .catch((error) => {
                console.log(error)
            })
    }

    
    </script>
    
    <h2>Anmelden</h2>
    
    <form class="row g-3">
    <div class="mb-3">
        <label for="usernameInput" class="form-label">Benutzername</label>
        <input on:change={checkUsername} bind:value={user.user_name} type="String" class="form-control" id="usernameInput" placeholder="Dein Benutzername">
    </div>
    <div class="mb-3">
        <label for="inputPassword" class="col-sm-2 col-form-label">Passwort</label>
        <!-- Bruchts das Div? <div class="col-sm-10"> -->
          <input on:change={checkPassword} bind:value={user.user_password} type="password" class="form-control" id="inputPassword">
        <!-- </div>-->
      </div>
      <div class="col-auto">
        <button disabled={disabled} type="button" on:click={checkAccount} class="btn btn-primary mb-3" >Anmelden</button>
      </div>
    </form>