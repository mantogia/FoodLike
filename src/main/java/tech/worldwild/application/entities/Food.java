package tech.worldwild.application.entities;


import javax.persistence.Entity;
import javax.persistence.Id;



@Entity
public class Food {

    @Id
    private long food_id;
    private String food_name;
    private String category;
    private String  sub_category_1;
    private String  sub_category_2;
    private String  sub_category_3;
    private String  sub_category_4;
    private String  sub_category_5;
    private String allergy;

    
    public Food(long food_id, String food_name, String category) {
        this.food_id = food_id;
        this.food_name = food_name;
        this.category = category;

    }

    
    public Food() {

    }
    
    public long getFood_id() {
        return food_id;
    }
    public void setFood_id(long food_id) {
        this.food_id = food_id;
    }
    public String getFood_name() {
        return food_name;
    }
    public void setFood_name(String food_name) {
        this.food_name = food_name;
    }
    public String getSub_category_1() {
        return sub_category_1;
    }
    public void setSub_category_1(String sub_category_1) {
        this.sub_category_1 = sub_category_1;
    }
    public String getSub_category_2() {
        return sub_category_2;
    }
    public void setSub_category_2(String sub_category_2) {
        this.sub_category_2 = sub_category_2;
    }
    public String getSub_category_3() {
        return sub_category_3;
    }
    public void setSub_category_3(String sub_category_3) {
        this.sub_category_3 = sub_category_3;
    }
    public String getSub_category_4() {
        return sub_category_4;
    }
    public void setSub_category_4(String sub_category_4) {
        this.sub_category_4 = sub_category_4;
    }
    public String getSub_category_5() {
        return sub_category_5;
    }
    public void setSub_category_5(String sub_category_5) {
        this.sub_category_5 = sub_category_5;
    }
    public String getCategory() {
        return category;
    }
    public void setCategory(String category) {
        this.category = category;
    }



    public String getAllergy() {
        return allergy;
    }



    public void setAllergy(String allergy) {
        this.allergy = allergy;
    }
    

}
