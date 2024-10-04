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
});

test("update", async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);

  let ID = loginRes.body["user"]["id"];
  expect(typeof ID).toBe("number");

  newEmail = randomName() + '@test.com';
  updateduser = { userID: ID, email: newEmail, password: testUser.password };

  adminUser = await createAdminUser();
  const adminRes = await request(app).put('/api/auth').send(adminUser);

  const updateRes = await request(app).put('/api/auth/1').send(updateduser).set("Authorization", "Bearer "+adminRes.body.token);

  expect(updateRes.body.email).toBe(newEmail);
});


/*
lots of console.logs throughout code
create new user for each test
use random name/number function for each test
go through each function I'm going to be using
*/
