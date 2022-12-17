# FoodLike

The web application FoodLike - nutritional analysis inspired by the mobile dating app [Tinder](https://tinder.com/).  
A project by students of the ZHAW SML Winterthur.

## Backend remarks 

Please make sure that [MySQL](https://dev.mysql.com/downloads/mysql/) is **installed** and **running**.  
Please replace the **username** and **password** for access permission to your personal MySQL database in the following file  
`📂 ./src/main/resources/application.properties`  
  
Create a new Schema in **MySQL** with the following name 

```sh
CREATE SCHEMA nutritionapp;
```
  
> **Note:** Please `Set as Default Schema`   

After the Schema has been created and you have selected `Set as Default Schema`: insert the necessary MySQL statements into the database.  
These statements can be found here `📂 ./src/main/resources/data.sql`

## Frontend Compilation

Open a terminal on `📂 ./svelte/` folder 
and launch `$ npm install` / `$ yarn`
to install dependencies

To launch frontend compilation in development mode:
`$ npm run java:dev` / `$ yarn java:dev`

To launch frontend compilation in production mode:
`$ npm run java` / `$ yarn java`

> **Note:** You will need to have [Node.js](https://nodejs.org) installed.

## Run application

To start the application, you can either use the [Visual Studio Code](https://code.visualstudio.com/) extension **[Spring Boot Dashboard](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-spring-boot-dashboard)** *(Recommended)*  

**OR**  

you can start the project directly through your terminal with the command:
```sh
mvn spring-boot:run
```  

Now you should be able to access the application via `localhost:8082` with a browser of your choice.  

## Important remarks

We have installed the following Visual Studio Code **Extensions** in our development environment. 
Not all are necessary for the execution of the application, but we highly recommend that you install them as well, otherwise we cannot guarantee smooth functionality.

| Extension | Version | Download |
| ------ | ------ | ------ |
| Debugger for Java |v0.47.0| [here](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) |
| Extension Pack for Java |v0.25.7| [here](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-pack) |
| IntelliCode |v1.2.29| [here](https://marketplace.visualstudio.com/items?itemName=VisualStudioExptTeam.vscodeintellicode) |
| IntelliCode API Usage Examples |v0.2.6| [here](https://marketplace.visualstudio.com/items?itemName=VisualStudioExptTeam.intellicode-api-usage-examples) |
| Language Support for Java(TM) by Red Hat |v1.13.0| [here](https://marketplace.visualstudio.com/items?itemName=redhat.java) |
| Maven for Java |v0.40.2| [here](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-maven) |
| Project Manager for Java |v0.21.1| [here](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-dependency) |
| Spring Boot Dashboard |v0.9.0| [here](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-spring-boot-dashboard) |
| Spring Boot Tools |v1.42.0| [here](https://marketplace.visualstudio.com/items?itemName=Pivotal.vscode-spring-boot) |
| Svelte for VS Code |v106.3.2| [here](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) |
| Test Runner for Java |v0.37.1| [here](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-test) |

> **Note regarding Version:** These are the versions we have installed in our development environment, in case there are any problems with future updates.

## Credit

### Svelte

https://svelte.dev

### Spring Boot

https://spring.io/projects/spring-boot

### Node.js

https://nodejs.org/en/

### Bootstrap

https://getbootstrap.com/

### MySQL

https://www.mysql.com/de/

### Chart.js

https://www.chartjs.org/

### jQuery

https://jquery.com/

### Axios

https://axios-http.com/

### Google Fonts

https://fonts.google.com/knowledge

### Font Awesome
 
 https://fontawesome.com/
