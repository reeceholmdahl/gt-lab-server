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
 * return an access token granted by a server for a given ttl. access token is 'email' + 'created' + 'ttl' hashed with the admin password
 * 
 * if POST /auth with a live token for the user with the respective email, will delete token and make a new token
 * 
 * Failure Codes
 * 400 - no email provided
 * 400 - no date provided
 * 400 - invalid date format
 * 400 - no authorization token provided
 * 401 - invalid authorization token provided
 * 401 - no admin with this email
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
 * 401 - invalid access token for the admin with this email
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
    
        let admin, token;
        await Promise.all([
            db.getAdmin(email ?? '').then(_admin => admin = _admin),
            db.getAdminAccessToken(email ?? '').then(_token => token = _token)
        ]);

        if (!admin) {
            res.status(401).send(`Could not find an admin with the email '${email}'`);
        }

        if (admin && token && new Date(token.created).getTime() + token.ttl < Date.now()) {
            
            db.revokeAdminAccessToken(email);
            token = false;
        }

        if (token && token.access_token === accessToken) {

            // Success case
            if (admin && token && new Date(token.created).getTime() + token.ttl >= Date.now()) {
                next();
            }
        } else {
            res.status(401).send(`Invalid access token for the admin with the email '${email}'`);
        }
    }
};

/**
 * GET /users
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
 * GET /users
 * REQUEST BODY { @credentials }
 * RESPONSE BODY [ ...users ]
 * 
 * Failure Codes @credentials
 * 404 - no user found with this email identifier
 */
router.get('/user/:email', [ verifyAccessToken ], async (req, res) => {

    const email = req.params.email;

    const user = await db.getUser(email);

    // Success case
    if (user) {
        delete user['password'];
        res.status(200).send(user);
    } else {
        res.status(404).send(`There is no user with the email '${email}'`);
    }
});

/**
 * POST /new-user
 * REQUEST BODY { @credentials , user_email: 'email' }
 * RESPONSE BODY { registration_token: 'token', ttl: 'ttl' }
 * 
 * Failures Codes @credentials
 * 400 - no user email provided
 * 400 - invalid email provided
 * 400 - already exists a user with this email identifier
 */
const DEFAULT_REGISTRATION_TOKEN_TTL = 6 * 60 * 60 * 1000; // 6 hours

router.post('/new-user', [ verifyAccessToken ], async (req, res) => {

    const userEmail = req.body?.user_email;

    // Error cases
    const errors = [];

    let validEmail, user;
    if (!userEmail) {
        res.status(400).send('No user email provided');
    } else if (!(validEmail = emailValidator.validate(userEmail))) {
        res.status(400).send(`The email '${userEmail}' is not a valid email address`);
    } else if ((user = await db.getUser(userEmail)) && user.email === userEmail) {
        res.status(400).send(`There is already a user with the email '${userEmail}'`);
    }

    // Success case
    if (userEmail && validEmail && (!user || user.email !== userEmail)) {
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

module.exports = router;