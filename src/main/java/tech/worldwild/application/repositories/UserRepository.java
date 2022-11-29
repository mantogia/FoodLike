package tech.worldwild.application.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import tech.worldwild.application.entities.User;

public interface UserRepository extends JpaRepository<User, Long>{

    @Query("SELECT s FROM User s WHERE s.user_name =:name")
    Optional<User> findByUserName(@Param("name") String name); 

    @Query("SELECT s.user_name FROM User s")
    Optional<List<String>> findAllUserNames(); 

    
    
}
