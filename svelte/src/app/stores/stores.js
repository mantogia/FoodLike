
import { writable } from 'svelte/store';


let control;
try{

    control = (JSON.parse(localStorage.current_user).user_id == 1)
} 
catch{
    
    control = (false);
}


export const admin = writable(control);
    


export function resetPage() {
    window.location.reload();
}

export function ausloggen(){
    console.log("logged out");
    localStorage.clear();
    const url= "http://localhost:8082/#/";
    window.location = url;
    resetPage();
    admin.set(false);
    return false
  }
cd