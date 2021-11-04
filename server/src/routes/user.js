const express = require('express');
const db = require('../db/cassandra.js');
const verifyRequestBody = require('../middleware/verify-request-body.js');
const errorMessage = require('../util/error-msg.js');
const crypto = require('crypto');

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
 * * 401 - invalid access token for the user with this email
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

        // Asynchronously retrieve the user and token respective to the credentials email
        let user, token;
        await Promise.all([
            db.getUser(email).then(_user => user = _user),
            db.getUserAccessToken(email).then(_token => token = _token)
        ]);

        // If the user object is null, there was no user in the database
        if (!user) {
            res.status(401).send(errorMessage(`Could not find a user with the email '${email}'`));
        }

        const tokenDeath = new Date(token.created).getTime() + token.ttl;

        // If there is a token, but the token alredy died, revoke the token from the database and set token to false
        if (/**user &&*/token && tokenDeath < Date.now()) {
            
            db.revokeUserAccessToken(email);
            token = false;
        }

        // If there is a token it is equal to the credentials access token
        if (token && token.access_token === accessToken) {

            // Success case; the user is valid and the token is alive, proceed to the next route handler
            if (user && token && tokenDeath >= Date.now()) {
                next();
            }
        }
        
        // If there is no valid access token
        else {
            res.status(401).send(errorMessage(`Invalid access token for the user with the email '${email}'`));
        }
    });
};

/**
 * # POST /auth
 * REQUEST BODY { auth_token: 'token', email: 'email', date: 'date' }
 * RESPONSE BODY { access_token: 'token', ttl: 'ttl' }
 * 
 * ! Send auth token 'email' + 'date' encrypted with hash with secret of password, for now HMAC sha-256
 * ! Receive an access token granted by a server for a given ttl. access token is 'email' + 'created' + 'ttl' hashed with the user password
 * ! If POST /auth with a live token for the user with the respective email, will delete token and make a new token
 * 
 * Failure Codes
 * * 400 - no email provided
 * * 400 - no date provided
 * * 400 - invalid date format
 * * 400 - no authorization token provided
 * * 401 - invalid authorization token provided
 * * 401 - no user with this email
 */
const DEFAULT_ACCESS_TOKEN_TTL = 1 * 60 * 60 * 1000; // 1 hour

router.post('/auth', [ verifyRequestBody({
    auth_token: String,
    email: String,
    date: Date
}) ], async (req, res) => {

    const email = req.body.email;
    const date = req.body.date;
    const authToken = req.body.auth_token;

    const user = await db.getUser(email);

    if (user) {

        const verifyAuthToken = crypto.createHash('sha256', user.password).update(String(user.email + date.toISOString())).digest('base64');

        if (authToken === verifyAuthToken) {

            const created = new Date();
            const ttl = DEFAULT_ACCESS_TOKEN_TTL;
            const accessToken = crypto.createHash('sha256', user.password).update(String(email + created.toISOString() + ttl)).digest('base64');

            await db.createUserAccessToken(email, accessToken, created.toISOString(), ttl);

            res.status(200).send({
                access_token: accessToken,
                ttl
            });

        } else {
            res.status(401).send(errorMessage('Invalid authorization token'));
        }

    } else {
        res.status(401).send(errorMessage(`Could not find a user with email '${email}'`));
    }
});

/**
 * # GET /geotab-data?from=<from (ISO String)>&to=<to (ISO String)>
 * REQUEST BODY { @credentials }
 * RESPONSE BODY { forward_braking_events: [ ...events], trips: [ ...trips ] }
 * 
 * Failure Codes @credentials
 * * 400 - no 'from' date provided
 * * 400 - no 'to' date provided
 * * 400 - 'from' date formatted incorrectly
 * * 400 - 'to' date formatted incorrectly
 * * 400 - invalid date range
 */
router.get('/geotab-data', [ verifyAccessToken ], (req, res) => {
    // Driving data (pulled straight from MyGeotab)
    res.send('hello');
});

/**
 * # GET /gt-lab-data?from=<from (ISO String)>&to=<to (ISO String)>
 * REQUEST BODY { @credentials }
 * RESPONSE BODY { eco_scores: [ ...{<score and date>} ], < other data as implemented in the future > }
 * 
 * Failure Codes @credentials
 * * 400 - no 'from' date provided
 * * 400 - no 'to' date provided
 * * 400 - 'from' date formatted incorrectly
 * * 400 - 'to' date formatted incorrectly
 * * 400 - invalid date range
 */
router.get('/gt-lab-data', [ verifyAccessToken ], (req, res) => {
    // Past data (computed on our hardware)
});

/**
 * # POST /register
 * REQUEST BODY { registration_token: 'token', email: 'email', first_name: '...', last_name: '...' }
 * RESPONSE BODY { success: 'bool', access_token: 'token', ttl: 'ttl' }
 * 
 * Failure Codes
 */
router.post('/register', (req, res) => {

});

module.exports = router;