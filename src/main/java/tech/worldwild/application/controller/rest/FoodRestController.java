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
import org.springframework.web.bind.annotation.ResponseBody;

import tech.worldwild.application.entities.Food;
import tech.worldwild.application.repositories.FoodRepository;

@Controller
public class FoodRestController {

 
    @Autowired
    private FoodRepository foodRepository;
    
    @GetMapping("/foods/{id}")
    public ResponseEntity<Food> getFoodByID(@PathVariable("id") Long id) {
        Optional<Food> f = foodRepository.findById(id);

        if(!f.isEmpty()){
            return new ResponseEntity<Food>(f.get(), HttpStatus.OK);
        }else{
            return new ResponseEntity<Food>(HttpStatus.NOT_FOUND);
        } 
    }

    @GetMapping("/foods/fragebogen")
    @ResponseBody
    public List<Food> getFoodListe(){
        Optional<List<String>> listCategories = foodRepository.getCategories();
        List<Food> listFood = new ArrayList<Food>();

        if(!listCategories.isEmpty()){

            for (String c : listCategories.get()) 
            {
                Optional<List<Food>> f = foodRepository.getTenFragen(c);
                if(!f.isEmpty()){
                    listFood.addAll(f.get());
                }
            }
        }

        return listFood;
        
    }
    
}
