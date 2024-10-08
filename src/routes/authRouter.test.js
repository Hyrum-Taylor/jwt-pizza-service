const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

const { Role, DB } = require('../database/database.js');
async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  await DB.addUser(user);

  user.password = 'toomanysecrets';
  return user;
}

beforeEach(async () => {
  testUser.email = randomName() + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(loginRes.body.user).toMatchObject(user);
  expect(typeof password).toBe("string");
});

test("update", async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);

  let ID = loginRes.body["user"]["id"];
  expect(typeof ID).toBe("number");

  let newEmail = randomName() + '@test.com';
  let updateduser = { userID: ID, email: newEmail, password: testUser.password };

  let adminUser = await createAdminUser();
  const adminRes = await request(app).put('/api/auth').send(adminUser); // need admin permissions to update user
  expect(adminRes.status).toBe(200);

  const updateRes = await request(app).put('/api/auth/1').send(updateduser).set("Authorization", "Bearer "+adminRes.body.token); // update user's email
  expect(updateRes.status).toBe(200);


  expect(updateRes.body.email).toBe(newEmail);
});

test('logout', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);

  //const testUserToken = loginRes.body.token;
  //console.log("Bearer "+loginRes.body.token);
  const logoutRes = await request(app).delete('/api/auth').set('Authorization', "Bearer "+loginRes.body.token); // logout
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe('logout successful');
  
  //const logoutRes = await request(app).delete("/api/auth").set("Authorization", "Bearer "+loginRes.body.token);
});

test("menu", async () => {
  let adminUser = await createAdminUser();
  const adminRes = await request(app).put('/api/auth').send(adminUser);

  const newPizzaType = { "title":"Student", "description": "No topping, no sauce, just carbs", "image":"pizza9.png", "price": 0.0001 };
  const itemAddRes = await request(app).put("/api/order/menu").send(newPizzaType).set("Authorization", "Bearer " + adminRes.body.token); // add new pizza to menu
  
  //const expectedMenuRes = [{ "id": 1, "title":"Student", "description": "No topping, no sauce, just carbs", "image":"pizza9.png", "price": 0.0001 }];
  expect(itemAddRes.body.at(-1)["description"]).toBe("No topping, no sauce, just carbs"); // check if the item was added
  const menuRes = await request(app).get("/api/order/menu"); // get menu so we can check that the pizza is there
  
  expect(menuRes.body.at(-1)["description"]).toBe("No topping, no sauce, just carbs"); // check if menu has item now
  //expect(menuRes.body).toStrictEqual([{ "id": 1, "title":"Student", "description": "No topping, no sauce, just carbs", "image":"pizza9.png", "price": 0.0001 }]);
});


test("user's orders", async () => {
  const orderRes = await request(app).get("/api/order").set("Authorization", "Bearer "+ testUserAuthToken); // list user's orders
  expect(orderRes.status).toBe(200);
  expect(orderRes.body["orders"]).toStrictEqual([]);

  const order = {"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]};

  const addItemRes = await request(app).post("/api/order").send(order).set("Authorization", "Bearer: "+testUserAuthToken); // add order
  expect(addItemRes.status).toBe(200);
  // At one point, I changed the secrets in the config.js, and it started giving me an error here: "message: 'Failed to fulfill order at factory'"

  expect(addItemRes.body["order"]["franchiseId"]).toBe(1);
  expect(addItemRes.body["order"]["items"][0]["description"]).toBe("Veggie");
})

test("franchise", async() => {
  const franchiseListRes = await request(app).get("/api/franchise"); // list all franchises
  expect(franchiseListRes.status).toBe(200);

  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);

  const userIDstring = JSON.stringify(loginRes.body["user"]["id"]);
  const myFranchiseRes = await request(app).get("/api/franchise/"+userIDstring).set("Authorization", "Bearer "+testUserAuthToken); // list user franchises
  expect(myFranchiseRes.status).toBe(200);
  expect(myFranchiseRes.body).toStrictEqual([]); // make sure new users don't have any franchises

  let adminUser = await createAdminUser();
  const adminRes = await request(app).put('/api/auth').send(adminUser);

  const addFranchiseRes = await request(app).post("/api/franchise").send({"name": "pizzaPocket"+userIDstring, "admins": [{"email": testUser.email}]}).set("Authorization", "Bearer: "+adminRes.body.token);
  console.log(addFranchiseRes.body);
  expect(addFranchiseRes.status).toBe(200);
  expect(addFranchiseRes.body["name"]).toBe("pizzaPocket"+userIDstring);
  
});


/*
lots of console.logs throughout code
create new user for each test
use random name/number function for each test
go through each function I'm going to be using
*/
