package tech.worldwild.application.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tech.worldwild.application.entities.Food_Rating;

public interface Food_RatingRepository extends JpaRepository<Food_Rating, Long> {


    @Query(
    value = "SELECT ft.* FROM Food_Rating ft WHERE ft.fk_user_id = :id", 
    nativeQuery = true)
    Optional<List<Food_Rating>> findRatingsFromUser(@Param("id") Long id);

    @Query(
    value = 
    "SELECT " + 
    "ft.rating, f.category " +
    "FROM Food_Rating ft " +
    "LEFT JOIN Food f ON ft.fk_food_id = f.food_id " + 
    "WHERE ft.fk_user_id = :id ",

    nativeQuery = true)
    Optional<List<?>> findRatingsFromUserString(@Param("id") Long id);


    @Query(
    value = 
    "SELECT " + 
    " f.category as category, sum(ft.rating) as summe, count(*) as anzahl, sum(ft.rating) / count(*) as average,  " +
    "SUM(CASE WHEN ft.rating = 0 THEN 1 ELSE 0 END), " +
    "SUM(CASE WHEN ft.rating = 1 THEN 1 ELSE 0 END), " +
    "SUM(CASE WHEN ft.rating = 2 THEN 1 ELSE 0 END), " +
    "ROUND(sum(ft.rating) / (count(*) * 2) * 100,0) as ergebnis " +

    "FROM Food_Rating ft " +
    "LEFT JOIN Food f ON ft.fk_food_id = f.food_id " + 
    "WHERE ft.fk_user_id = :id " +
    "GROUP BY f.category",

    nativeQuery = true)
    Optional<List<?>> getEvaluation(@Param("id") Long id);


    @Query(
    value = 
    "SELECT " + 
    " f.category as category, sum(ft.rating) as summe, count(*) as anzahl, sum(ft.rating) / count(*) as average,  " +
    "SUM(CASE WHEN ft.rating = 0 THEN 1 ELSE 0 END), " +
    "SUM(CASE WHEN ft.rating = 1 THEN 1 ELSE 0 END), " +
    "SUM(CASE WHEN ft.rating = 2 THEN 1 ELSE 0 END) " +
    
    
    "FROM Food_Rating ft " +
    "LEFT JOIN Food f ON ft.fk_food_id = f.food_id " + 
    "WHERE ft.fk_user_id = :id " +
    "GROUP BY f.category",

    nativeQuery = true)
    Optional<List<?>> getTest(@Param("id") Long id);

    @Query(
    value = 
    "SELECT " + 
    "ft.fragebogen " +
    "FROM Food_Rating ft " +
    "WHERE ft.fk_user_id = :id " +
    "GROUP BY ft.fragebogen " +
    "ORDER BY ft.fragebogen ",

    nativeQuery = true)
    Optional<List<Integer>> getNewFragebogen(@Param("id") Long id);


    
    @Query(
    value = 
    "SELECT " + 
    "ft.* " +
    "FROM Food_Rating ft " +
    "WHERE ft.fk_user_id = :user_id and ft.fk_food_id = :food_id and ft.fragebogen = :fragebogen ",

    nativeQuery = true)
    Optional<Food_Rating> findByUserAndFood(@Param("user_id") Long u_id, @Param("food_id") Long f_id, @Param("fragebogen") Integer fragebogen);
    
}
