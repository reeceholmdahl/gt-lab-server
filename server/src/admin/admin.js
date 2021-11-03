const express = require('express');
const crypto = require('crypto');
const db = require('../db/cassandra.js');

const router = express.Router();

function _error(res) {
    return function error(...messages) {
        if (!error.stop) {
            res.status(400).send({
                messages
            });
        }
    };
}

/**
 * POST /auth
 * REQUEST BODY { auth_token: 'token', email: 'email', date: 'date' }
 * RESPONSE BODY { access_token: 'token', ttl: 'ttl' }
 * 
 * send auth token 'email' + 'date' encrypted with hash with secret of password, for now HMAC sha-256
 * return an access token granted by a server for a given ttl. access token is 'email' + 'created' + 'ttl' hashed with the admin password
 * 
 * if POST /auth with a live token for the user with the respective email, will delete token and make a new token
 */
const TOKEN_TTL = 1 * 60 * 60 * 1000 // 1 hour

router.post('/auth', async (req, res) => {

    const error = _error(res);

    const email = req.body?.email;
    const date = new Date(req.body?.date);
    const authToken = req.body?.auth_token;
    
    // Error cases
    let errors = [];

    if (!email) {
        errors.push('No email provided');
    }

    if (!date) {
        errors.push('No date provided');
    }

    if (date && !date.toJSON()) {
        errors.push('Invalid date format');
    }

    if (!authToken) {
        errors.push('No authorization token provided');
    }

    // Success case
    if (email && (date && date.toJSON()) && authToken) {
        const admin = await db.getAdmin(email);

        if (admin) {

            const verifyAuthToken = crypto.createHash('sha256', admin.password).update(String(admin.email + date.toISOString())).digest('base64');

            if (authToken === verifyAuthToken) {

                const created = new Date();
                const ttl = TOKEN_TTL;
                const accessToken = crypto.createHash('sha256', admin.password).update(String(email + created.toISOString() + ttl)).digest('base64');

                await db.createAdminAccessToken(email, accessToken, created.toISOString(), ttl);

                res.status(200).send({
                    access_token: accessToken,
                    ttl
                });

            } else {
                error('Invalid authorization token');
            }

        } else {
            error(`Could not find an admin with email '${email}'`);
        }
    } else {
        error(...errors);
    }
});

const verifyAccessToken = async (req, res, next) => {

    const error = _error(res);

    const email = req.body?.email;
    const accessToken = req.body?.access_token;

    // Failure cases
    const errors = [];

    if (!email) {
        errors.push('No email provided');
    }

    if (!accessToken) {
        errors.push('No access token provided');
    }

    if (email && accessToken) {
    
        let admin, token;
        await Promise.all([
            db.getAdmin(email ?? '').then(_admin => admin = _admin),
            db.getAdminAccessToken(email ?? '').then(_token => token = _token)
        ]);

        if (!admin) {
            errors.push(`Could not find an admin with the email '${email}'`);
        }

        if (admin && token && new Date(token.created).getTime() + token.ttl < Date.now()) {
            
            db.revokeAdminAccessToken(email);
            token = false;
        }

        if (token && token.access_token === accessToken) {

            // Success case
            if (admin && token && new Date(token.created).getTime() + token.ttl >= Date.now()) {
                error.stop = true;
                next();
            }
        } else {
            errors.push(`Incorrect access token for the admin with the email '${email}'`);
        }
    }

    error(...errors);
}

/**
 * GET /users
 * REQUEST BODY { email: 'email', access_token: 'token' }
 */
router.get('/users', [ verifyAccessToken ], async (req, res) => {

    const users = (await db.getUsers()).map(user => {
        delete user['password'];
        return user;
    });

    res.send(users);
});

module.exports = router;