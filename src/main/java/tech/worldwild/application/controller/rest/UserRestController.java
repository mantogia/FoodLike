package tech.worldwild.application.controller.rest;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;

import tech.worldwild.application.entities.Food;
import tech.worldwild.application.entities.Food_Rating;
import tech.worldwild.application.entities.User;
import tech.worldwild.application.repositories.FoodRepository;
import tech.worldwild.application.repositories.Food_RatingRepository;
import tech.worldwild.application.repositories.UserRepository;


@Controller
public class UserRestController {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private Food_RatingRepository foodRatingRepository;

    @Autowired
    private FoodRepository foodRepository;



    
    
    @GetMapping("/users/{id}")
    public ResponseEntity<User> getUserByID(@PathVariable("id") Long id) {
        Optional<User> u = userRepository.findById(id);

        if(!u.isEmpty()){
            return new ResponseEntity<User>(u.get(), HttpStatus.OK);
        }else{
            return new ResponseEntity<User>(HttpStatus.NOT_FOUND);
        } 
        
    }

    @PostMapping("/users")
    @ResponseBody
    User newUser(@RequestBody User newUser){
        return userRepository.save(newUser);
    }


    @GetMapping("/users/name/{name}")
    public ResponseEntity<User> getUserByName(@PathVariable("name") String name) {
        Optional<User> u = userRepository.findByUserName(name);

        if(!u.isEmpty()){
            return new ResponseEntity<User>(u.get(), HttpStatus.OK);
        }else{
            return new ResponseEntity<User>(HttpStatus.NOT_FOUND);
        } 
        
    }

    @GetMapping("/users/name")
    public ResponseEntity<List<String>> getUserNames() {
        Optional<List<String>> ulist = userRepository.findAllUserNames();

        if(!ulist.isEmpty()){
            return new ResponseEntity<List<String>>(ulist.get(), HttpStatus.OK);
        }else{
            return new ResponseEntity<List<String>>(HttpStatus.NOT_FOUND);
        } 
        
    }

    @GetMapping("/users/{id}/food_ratings")
    public ResponseEntity<List<Food_Rating>> getFoodRatingsByUserId(@PathVariable("id") long id) {
        Optional<User> u = userRepository.findById(id);

        if(!u.isEmpty()){
            return new ResponseEntity<List<Food_Rating>>(u.get().getFood_ratingsObjects(), HttpStatus.OK);
        }else{
            return new ResponseEntity<List<Food_Rating>>(HttpStatus.NOT_FOUND);
        } 
        
    }

    @GetMapping("/users/{id}/fragebogen")
    @ResponseBody
    public ResponseEntity<List<Food_Rating>> createNewFragebogen(@PathVariable("id") long id) {
        Optional<User> u = userRepository.findById(id);

        if(u.get().getFood_ratings().size() > 0){
            return new ResponseEntity<List<Food_Rating>>(u.get().getFood_ratingsObjects(), HttpStatus.OK);
        }

        List<Food> listFood = new ArrayList<Food>();

        
        Optional<List<String>> listCategories = foodRepository.getCategories();
        if(!listCategories.isEmpty()){

            for (String c : listCategories.get()) 
            {
                Optional<List<Food>> f = foodRepository.getTenFragen(c);
                if(!f.isEmpty()){
                    listFood.addAll(f.get());
                }
            }
        }

        Optional<List<Integer>> fragebogenList = foodRatingRepository.getNewFragebogen(id);
        Integer fragebogen = 1;

        if (!fragebogenList.isEmpty()){
            fragebogen = fragebogenList.get().get(fragebogenList.get().size() -1) + 1;
        }else{
            
        }
        for (Food f : listFood) 
            {
                Food_Rating newfr = new Food_Rating();
                newfr.setFood(f);
                newfr.setUser(u.get());
                newfr.setFragebogen(fragebogen);

                foodRatingRepository.save(newfr);

            }

        if(!u.isEmpty()){
            return new ResponseEntity<List<Food_Rating>>(u.get().getFood_ratingsObjects(), HttpStatus.OK);
        }else{
            return new ResponseEntity<List<Food_Rating>>(HttpStatus.NOT_FOUND);
        } 
        
    }
    

}
