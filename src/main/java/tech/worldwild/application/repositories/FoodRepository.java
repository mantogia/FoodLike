package tech.worldwild.application.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import tech.worldwild.application.entities.Food;

public interface FoodRepository  extends JpaRepository <Food, Long> {



    @Query(
    value = 
    "SELECT " + 
    "f.*  " +
    "FROM Food f " +
    "WHERE f.category = :kategorie limit 20" ,

    nativeQuery = true)
    Optional<List<Food>> getTenFragen(@Param("kategorie") String kategorie);


    @Query(
    value = 
    "SELECT " + 
    "f.category  " +
    "FROM Food f " +
    /*"WHERE f.category <> 'Alkoholfreie Getränke' " + 
    "AND f.category <> 'Alkoholhaltige Getränke' " + 
    "AND f.category <> 'Verschiedenes' " + 
    "AND f.category <> 'Gerichte' " + 
    "AND f.category <> 'Speziallebensmittel' " + 
    "AND f.category <> 'Fleischersatzprodukte' " +*/
    "GROUP BY f.category" 
     
    ,
    nativeQuery = true)
    Optional<List<String>> getCategories();
    
}
