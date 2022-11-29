package tech.worldwild.application.entities;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
public class Food_Rating {


    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;
    
    @ManyToOne (optional = false, cascade = CascadeType.PERSIST)
    @JoinColumn(name = "fk_user_id")
    private User user;

    @ManyToOne (optional = false, cascade = CascadeType.PERSIST)
    @JoinColumn(name = "fk_food_id")
    private Food food;

    @Column
    private int rating = 99;

    @Column
    private Integer fragebogen;


    public Food_Rating(User user, Food food, int rating, Integer fragebogen) {
        this.user = user;
        this.food = food;
        this.rating = rating;
        this.fragebogen = fragebogen;

    }

    

    public Food_Rating() {

    }

    public Long getId() {
        return id;
    }


    public void setId(Long id) {
        this.id = id;
    }

    @JsonIgnore
    public User getUser() {
        return user;
    }


    public void setUser(User user) {
        this.user = user;
    }

    
    public Food getFood() {
        return food;
    }

    @JsonProperty("main_category")
    public String getFoodCategory() {

        String result = food.getCategory();
        return result;
    }


    public void setFood(Food food) {
        this.food = food;
    }


    public int getRating() {
        return rating;
    }


    public void setRating(int rating) {
        this.rating = rating;
    }


    public Integer getFragebogen() {
        return fragebogen;
    }


    public void setFragebogen(Integer fragebogen) {
        this.fragebogen = fragebogen;
    }

    

}
