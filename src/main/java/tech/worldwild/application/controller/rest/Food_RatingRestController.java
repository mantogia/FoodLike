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
import org.springframework.web.bind.annotation.ResponseBody;

import tech.worldwild.application.entities.Food;
import tech.worldwild.application.entities.Food_Rating;
import tech.worldwild.application.entities.User;
import tech.worldwild.application.repositories.FoodRepository;
import tech.worldwild.application.repositories.Food_RatingRepository;
import tech.worldwild.application.repositories.UserRepository;

@Controller
public class Food_RatingRestController {
    
    @Autowired
    private Food_RatingRepository foodRatingRepository;

    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private FoodRepository foodRepository;

    @PostMapping("/food_ratings/{fk_user_id}/{fk_food_id}/{rating}")
    public ResponseEntity<Food_Rating> newFoodRating(
        @PathVariable("fk_user_id") long id_user, 
        @PathVariable("fk_food_id") long id_food,
        @PathVariable("rating") int rating)
    {
        Optional<User> u = userRepository.findById(id_user);
        Optional<Food> f = foodRepository.findById(id_food);

        if (!u.isEmpty() && !f.isEmpty()) {
			User u1 = u.get();
			Food f1 = f.get();

            Food_Rating fr = new Food_Rating();
            fr.setUser(u1);
            fr.setFood(f1);
            fr.setRating(rating);
            return new ResponseEntity<Food_Rating>(foodRatingRepository.save(fr), HttpStatus.OK);
        } else {

            return new ResponseEntity<Food_Rating>(HttpStatus.NOT_FOUND);
        }

    }

    @PostMapping("/food_ratings/new/{fk_user_id}/{fk_food_id}/{rating}/{fragebogen}")
    public ResponseEntity<Food_Rating> newFoodRatingNew(
        @PathVariable("fk_user_id") long id_user, 
        @PathVariable("fk_food_id") long id_food,
        @PathVariable("rating") int rating,
        @PathVariable("fragebogen") Integer fragebogen)
    {
        Optional<User> u = userRepository.findById(id_user);
        Optional<Food> f = foodRepository.findById(id_food);

        if (!u.isEmpty() && !f.isEmpty()) {
			User u1 = u.get();
			Food f1 = f.get();

            Food_Rating fr = new Food_Rating();
            fr.setUser(u1);
            fr.setFood(f1);
            fr.setRating(rating);
            fr.setFragebogen(fragebogen);
            return new ResponseEntity<Food_Rating>(foodRatingRepository.save(fr), HttpStatus.OK);
        } else {

            return new ResponseEntity<Food_Rating>(HttpStatus.NOT_FOUND);
        }

    }
        

    /*@GetMapping("/users/{id}/food_ratings")
    public ResponseEntity<List<Food_Rating>> getFoodRatingsByUserId(@PathVariable("id") long id) {
        Optional<User> u = userRepository.findById(id);

        if(!u.isEmpty()){
            return new ResponseEntity<List<Food_Rating>>(u.get().getFood_ratingsObjects(), HttpStatus.OK);
        }else{
            return new ResponseEntity<List<Food_Rating>>(HttpStatus.NOT_FOUND);
        } 
        
    }*/

  
    @GetMapping("/food_ratings/users/{id}")
    public ResponseEntity<List<Food_Rating>> findRatingsFromUser(@PathVariable("id") long id) {
        Optional<List<Food_Rating>> fr_list = foodRatingRepository.findRatingsFromUser(id);

        if(!fr_list.isEmpty()){
            return new ResponseEntity<List<Food_Rating>>(fr_list.get(), HttpStatus.OK);
        }else{
            return new ResponseEntity<List<Food_Rating>>(HttpStatus.NOT_FOUND);
        } 
        
    }

    /*@GetMapping("/food_ratings/users/{id}/string")
    public List findRatingsFromUserString(@PathVariable("id") long id) {
        Optional<List> fr_list = foodRatingRepository.findRatingsFromUserString(id);

        if(!fr_list.isEmpty()){
            return fr_list.get();
        }else{
            return new ArrayList<>();
        } 
        
    }*/

    @GetMapping("/food_ratings/users/{id}/string")
    @ResponseBody
    public List<?> findRatingsFromUserString(@PathVariable("id") long id) {
        Optional<List<?>> fr_list = foodRatingRepository.getEvaluation(id);
        
        if(!fr_list.isEmpty()){
            return fr_list.get();
        }else{
            return new ArrayList<>();
        } 
        
    }

        // Annotatio
        @PostMapping("/food_ratings/{fk_user_id}/{fk_food_id}/{fragebogen}/{rating}")

        // Method
        public ResponseEntity<Food_Rating> change(
            @PathVariable Long fk_user_id, 
            @PathVariable Long fk_food_id, 
            @PathVariable Integer fragebogen, 
            @PathVariable int rating
            ) {
    
            Optional<Food_Rating> fr = foodRatingRepository.findByUserAndFood(fk_user_id, fk_food_id, fragebogen);
            
            
            if(!fr.isEmpty()){
                fr.get().setRating(rating);
                return new ResponseEntity<Food_Rating>(foodRatingRepository.save(fr.get()), HttpStatus.OK);
            }else{
                return new ResponseEntity<Food_Rating>(HttpStatus.NOT_FOUND);
            } 
            
        }

}
