const express = require('express');
const db = require('../db/cassandra.js');
const drivingData = require('../geotab/driving-data.js');
const verifyRequestBody = require('../middleware/verify-request-body.js');
const errorMessage = require('../util/error-msg.js');
const crypto = require('crypto');
const emailValidator = require('email-validator');
const path = require('path');
const fs = require('fs/promises');

// Express router
const router = express.Router();

/**
 * # Verify Access Token: @credentials
 * REQUEST BODY contains: credentials: { email: 'email', access_token: 'token' }
 * 
 * Failure Codes
 * * 400 - no email provided
 * * 400 - no access token provided
 * * 401 - no admin with this email
 * * 401 - invalid access token for the admin with this email
 */
const verifyAccessToken = async (req, res, next) => {

    // Verify that the request body contains the proper credentials object with middleware-generating function
    const checkCredentialsObject = verifyRequestBody({
       credentials: {
           email: String,
           access_token: String
       }
   });
   
   // Sub the 'next' function in the middleware for the verify access token function
   checkCredentialsObject(req, res, async () => {

       // If we've made it this far, we can be certain 'email' and 'access_token' exist
       const email = req.body.credentials.email;
       const accessToken = req.body.credentials.access_token;

       // Asynchronously retrieve the admin and token respective to the credentials email
       let admin, token;
       await Promise.all([
           db.getAdmin(email).then(_admin => admin = _admin),
           db.getAdminAccessToken(email).then(_token => token = _token)
       ]);

       // If the admin object is null, there was no admin in the database
       if (!admin) {
           res.status(401).send(errorMessage(`Could not find an admin with the email '${email}'`));
       }

       const tokenDeath = new Date(token?.created).getTime() + token?.ttl;

       // If there is a token, but the token alredy died, revoke the token from the database and set token to false
       if (/**user &&*/token && tokenDeath < Date.now()) {
           
           db.revokeAdminAccessToken(email);
           token = false;
       }

       // If there is a token it is equal to the credentials access token
       if (token && token.access_token === accessToken) {

           // Success case; the admin is valid and the token is alive, proceed to the next route handler
           if (admin && token && tokenDeath >= Date.now()) {
               next();
           }
       }
       
       // If there is no valid access token
       else {
           res.status(401).send(errorMessage(`Invalid access token for the admin with the email '${email}'`));
       }
   });
};

/**
 * # POST /auth
 * REQUEST BODY { auth_token: 'token', email: 'email', date: 'date' }
 * RESPONSE BODY { access_token: 'token', ttl: 'ttl' }
 * 
 * ! Send auth token 'email' + 'date' encrypted with hash with secret of password, for now HMAC sha-256
 * ! Return an access token granted by a server for a given ttl. access token is 'email' + 'created' + 'ttl' hashed with the admin password
 * ! If POST /auth with a live token for the user with the respective email, will delete token and make a new token
 * 
 * Failure Codes
 * * 400 - no email provided
 * * 400 - no date provided
 * * 400 - invalid date format
 * * 400 - no authorization token provided
 * * 401 - invalid authorization token provided
 * * 401 - no admin with this email
 */
const DEFAULT_ACCESS_TOKEN_TTL = 1 * 60 * 60 * 1000; // 1 hour

router.post('/auth', [ verifyRequestBody({
    auth_token: String,
    email: String,
    date: Date
}) ], async (req, res) => {

    const email = req.body.email;
    const date = new Date(req.body.date);
    const authToken = req.body.auth_token;

    // Success case
    const admin = await db.getAdmin(email);

    if (admin) {

        const verifyAuthToken = crypto.createHash('sha256', admin.password).update(String(admin.email + date.toISOString())).digest('base64');

        if (authToken === verifyAuthToken) {

            const created = new Date();
            const ttl = DEFAULT_ACCESS_TOKEN_TTL;
            const accessToken = crypto.createHash('sha256', admin.password).update(String(email + created.toISOString() + ttl)).digest('base64');

            await db.createAdminAccessToken(email, accessToken, created.toISOString(), ttl);

            res.status(200).send({
                access_token: accessToken,
                ttl
            });

        } else {
            res.status(401).send(errorMessage('Invalid authorization token'));
        }

    } else {
        res.status(401).send(errorMessage(`Could not find an admin with email '${email}'`));
    }
});

/**
 * # GET /users
 * REQUEST BODY { @credentials }
 * RESPONSE BODY [ ...users ]
 * 
 * Failure Codes @credentials
 */
router.get('/users', [ verifyAccessToken ], async (req, res) => {

    const users = (await db.getUsers()).map(user => {
        delete user['password'];
        return user;
    });

    res.send(users);
});

/**
 * # GET /user/<email>
 * REQUEST BODY { @credentials }
 * RESPONSE BODY: user: { ... }
 * 
 * Failure Codes @credentials
 * * 404 - no user found with this email identifier
 */
router.get('/user/:email', [ verifyAccessToken ], async (req, res) => {

    const email = req.params?.email;

    const user = await db.getUser(email);

    // Success case
    if (user) {
        delete user['password'];
        res.status(200).send(user);
    } else {
        res.status(404).send(errorMessage(`There does not exist a user with the email '${email}'`));
    }
});

/**
 * # POST /new-user
 * REQUEST BODY { @credentials , user_email: 'email' }
 * RESPONSE BODY { registration_token: 'token', ttl: 'ttl' }
 * 
 * Failures Codes @credentials
 * * 400 - no user email provided
 * * 400 - invalid email provided
 * * 400 - already exists a user with this email identifier
 */
const DEFAULT_REGISTRATION_TOKEN_TTL = 6 * 60 * 60 * 1000; // 6 hours

router.post('/new-user', [ verifyRequestBody({
    user_email: String
}), verifyAccessToken ], async (req, res) => {

    const userEmail = req.body.user_email;

    // Error cases
    const validEmail = emailValidator.validate(userEmail);
    if (!validEmail) {
        res.status(400).send(errorMessage(`The email '${userEmail}' is not a valid email`));
    }

    const user = await db.getUser(userEmail);

    if (user) {
        res.status(400).send(errorMessage(`There already exists a user with the email '${userEmail}'`));
    }

    // Success case
    if (validEmail && !user) {
        const ascii = [];
        for (let i = 0; i < 16; ++i) {
            const code = (Math.random() < 0.5 ? 65 : 97) + Math.floor(Math.random() * 26);
            ascii.push(code);
        }

        const token = String.fromCharCode(...ascii);

        const now = new Date();

        db.createUserRegistrationToken(userEmail, token, now.toISOString(), DEFAULT_REGISTRATION_TOKEN_TTL);

        res.status(200).send({
            registration_token: token,
            ttl: DEFAULT_REGISTRATION_TOKEN_TTL
        });
    }
});

/**
 * # GET /data/acc-x
 * REQUEST BODY { @credentials }
 * RESPONSE BODY [ ...acc_x_event ]
 * QUERY PARAMS from (from date), to (to date), vehicle (vehicle name)
 */
router.get('/data/acc-x', [ verifyAccessToken ], async (req, res) => {

    const { from, to, vehicle } = req.query;

    const id = await drivingData.deviceIdFromName(vehicle);

    res.send(await drivingData.getAccXEvents(id, new Date(from), new Date(to)));
});

/**
 * # GET /data/acc-y
 * REQUEST BODY { @credentials }
 * RESPONSE BODY [ ...acc_y_event ]
 * QUERY PARAMS from (from date), to (to date), vehicle (vehicle name)
 */
router.get('/data/acc-y', [ verifyAccessToken ], async (req, res) => {

    const { from, to, vehicle } = req.query;

    const id = await drivingData.deviceIdFromName(vehicle);

    res.send(await drivingData.getAccYEvents(id, new Date(from), new Date(to)));
});

/**
 * # GET /data/trips
 * REQUEST BODY { @credentials }
 * RESPONSE BODY [ ...trip ]
 * QUERY PARAMS from (from date), to (to date), vehicle (vehicle name)
 */
router.get('/data/trips', [ verifyAccessToken ], async (req, res) => {

    const { from, to, vehicle } = req.query;

    const id = await drivingData.deviceIdFromName(vehicle);

    res.send(await drivingData.getTrips(id, new Date(from), new Date(to)));
});

/**
 * # GET /data/speeding
 * REQUEST BODY { @credentials }
 * RESPONSE BODY [ ...speeding_event ]
 * QUERY PARAMS from (from date), to (to date), vehicle (vehicle name)
 */
router.get('/data/speeding', [ verifyAccessToken ], async (req, res) => {

    const { from, to, vehicle } = req.query;

    const id = await drivingData.deviceIdFromName(vehicle);

    res.send(await drivingData.getSpeedingEvents(id, new Date(from), new Date(to)));
});

/**
 * # GET /csv/acc-x/:MM-DD-YY
 * REQUEST BODY { @credentials }
 * RESPONSE csv-formatted AccX events
 * QUERY PARAMS vehicle (vehicle name)
 * 
 * Gets accX events on the specified date and by the vehicle in a CSV format. If the day has not yet occurred or concluded there will be an error.
 */

/**
 * # GET /csv/acc-y/:MM-DD-YY
 * REQUEST BODY { @credentials }
 * RESPONSE csv-formatted AccY events
 * QUERY PARAMS vehicle (vehicle name)
 * 
 * Gets accY events on the specified date and by the vehicle in a CSV format. If the day has not yet occurred or concluded there will be an error.
 */

/**
 * # GET /csv/trips/:MM-DD-YY
 * REQUEST BODY { @credentials }
 * RESPONSE csv-formatted Trips
 * QUERY PARAMS vehicle (vehicle name)
 * 
 * Gets all trips on the specified date by the vehicle in a CSV format. If the day has not yet occurred or concluded there will be an error.
 */

/**
 * # GET /csv/speeding/:MM-DD-YY
 * REQUEST BODY { @credentials }
 * RESPONSE csv-formatted Speeding events
 * QUERY PARAMS vehicle (vehicle name)
 * 
 * Gets all speeding events on the specified date and by the vehicle in a CSV format. If the day has not yet occurred or concluded there will be an error.
 */

module.exports = router;
module.exports.verifyAccessToken = verifyAccessToken;