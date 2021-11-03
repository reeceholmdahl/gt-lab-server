const express = require('express');
const crypto = require('crypto');
const db = require('../db/cassandra.js');
const emailValidator = require('email-validator');

const router = express.Router();

/**
 * POST /auth
 * REQUEST BODY { auth_token: 'token', email: 'email', date: 'date' }
 * RESPONSE BODY { access_token: 'token', ttl: 'ttl' }
 * 
 * send auth token 'email' + 'date' encrypted with hash with secret of password, for now HMAC sha-256
 * return an access token granted by a server for a given ttl. access token is 'email' + 'created' + 'ttl' hashed with the user password
 * 
 * if POST /auth with a live token for the user with the respective email, will delete token and make a new token
 * 
 * Failure Codes
 * 400 - no email provided
 * 400 - no date provided
 * 400 - invalid date format
 * 400 - no authorization token provided
 * 401 - invalid authorization token provided
 * 401 - no user with this email
 */
const DEFAULT_ACCESS_TOKEN_TTL = 1 * 60 * 60 * 1000; // 1 hour

router.post('/auth', async (req, res) => {

    const email = req.body?.email;
    const date = new Date(req.body?.date);
    const authToken = req.body?.auth_token;
    
    // Error cases
    if (!email) {
        res.status(400).send('No email provided');
    }

    if (!date) {
        res.status(400).send('No date provided');
    }

    if (date && !date.toJSON()) {
        res.status(400).send('Invalid date format');
    }

    if (!authToken) {
        res.status(400).send('No authorization token provided');
    }

    // Success case
    if (email && (date && date.toJSON()) && authToken) {
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
                res.status(401).send('Invalid authorization token');
            }

        } else {
            res.status(401).send(`Could not find an admin with email '${email}'`);
        }
    }
});

/**
 * Verify Access Token: @credentials
 * credentials: { email: 'email', access_token: 'token' }
 * 
 * Failure Codes
 * 400 - no email provided
 * 400 - no access token provided
 * 401 - no admin with this email
 * 401 - invalid access token for the user with this email
 */
const verifyAccessToken = async (req, res, next) => {

    const email = req.body?.credentials?.email;
    const accessToken = req.body?.credentials?.access_token;

    if (!email) {
        res.status(400).send('No email provided');
    }

    if (!accessToken) {
        res.status(400).send('No access token provided');
    }

    if (email && accessToken) {
    
        let user, token;
        await Promise.all([
            db.getUser(email ?? '').then(_user => user = _user),
            db.getUserAccessToken(email ?? '').then(_token => token = _token)
        ]);

        if (!user) {
            res.status(401).send(`Could not find an admin with the email '${email}'`);
        }

        if (user && token && new Date(token.created).getTime() + token.ttl < Date.now()) {
            
            db.revokeUserAccessToken(email);
            token = false;
        }

        if (token && token.access_token === accessToken) {

            // Success case
            if (user && token && new Date(token.created).getTime() + token.ttl >= Date.now()) {
                next();
            }
        } else {
            res.status(401).send(`Invalid access token for the admin with the email '${email}'`);
        }
    }
};

/**
 * GET /geotab-data?from=<from (ISO String)>&to=<to (ISO String)>
 * REQUEST BODY { @credentials }
 * RESPONSE BODY { forward_braking_events: [ ...events], trips: [ ...trips ] }
 * 
 * Failure Codes @credentials
 * 400 - no 'from' date provided
 * 400 - no 'to' date provided
 * 400 - 'from' date formatted incorrectly
 * 400 - 'to' date formatted incorrectly
 * 400 - invalid date range
 */
router.get('/geotab-data', [ verifyAccessToken ], (req, res) => {
    // Driving data (pulled straight from MyGeotab)
});

/**
 * GET /gt-lab-data?from=<from (ISO String)>&to=<to (ISO String)>
 * REQUEST BODY { @credentials }
 * RESPONSE BODY { eco_scores: [ ...{<score and date>} ], < other data as implemented in the future > }
 * 
 * Failure Codes @credentials
 * 400 - no 'from' date provided
 * 400 - no 'to' date provided
 * 400 - 'from' date formatted incorrectly
 * 400 - 'to' date formatted incorrectly
 * 400 - invalid date range
 */
router.get('/gt-lab-data', [ verifyAccessToken ], (req, res) => {
    // Past data (computed on our hardware)
});

/**
 * POST /register
 * REQUEST BODY { registration_token: 'token', email: 'email', first_name: '...', last_name: '...' }
 * RESPONSE BODY { success: 'bool', access_token: 'token', ttl: 'ttl' }
 * 
 * Failure Codes
 */
router.post('/register', (req, res) => {

});

module.exports = router;