const cassandra = require('cassandra-driver');

const db = new cassandra.Client({
    contactPoints: [
        '127.0.0.1'
    ],
    localDataCenter: 'datacenter1',
    keyspace: 'gt_lab_server'
});

function trim(...args) {
    args = args.map(arg => {
        return arg.toLowerCase().trim();
    });

    if (args.length == 1) return args[0];
    return args;
}

async function getUsers() {
    const query = 'SELECT * FROM users';
    const result = await db.execute(query);
    return result.rows;
}

async function getUser(email) {
    const query = 'SELECT * FROM users WHERE email = ?';
    const result = await db.execute(query, [ email ]);
    if (result.rows[0]) return result.rows[0];
    return null;
}

async function getAdmins() {
    const query = 'SELECT * FROM admins';
    const result = await db.execute(query);
    return result.rows;
}

async function getAdmin(email) {
    const query = 'SELECT * FROM admins WHERE email = ?';
    const result = await db.execute(query, [ email ]);
    if (result.rows[0]) return result.rows[0];
    return null;
}

async function getAdminAccessTokens() {
    const query = 'SELECT * FROM admin_access_tokens';
    const result = await db.execute(query);
    return result.rows;
}

async function getAdminAccessToken(email) {
    const query = 'SELECT * FROM admin_access_tokens WHERE email = ?';
    const result = await db.execute(query, [ email ]);
    if (result.rows[0]) return result.rows[0];
    return null;
}

async function createAdminAccessToken(email, accessToken, created, ttl) {
    let query;

    if (await getAdminAccessToken(email)) {
        query = 'UPDATE admin_access_tokens SET access_token = ? , created = ? , ttl = ? WHERE email=?';
    } else {
        query = 'INSERT INTO admin_access_tokens ( access_token, created, ttl, email ) VALUES ( ?, ?, ?, ? )';
    }

    await db.execute(query, [ accessToken, created, ttl, email ], { prepare: true });
}

async function getUserAccessTokens() {
    const query = 'SELECT * FROM user_access_tokens';
    const result = await db.execute(query);
    return result.rows;
}

async function getUserAccessToken(email) {
    const query = 'SELECT * FROM user_access_tokens WHERE email = ?';
    const result = await db.execute(query, [ email ]);
    if (result.rows[0]) return result.rows[0];
    return null;
}

async function revokeAdminAccessToken(email) {
    const query = 'DELETE FROM admin_access_tokens WHERE email = ?';
    await db.execute(query, [ email ]);
}

async function createUserAccessToken(email, accessToken, created, ttl) {
    let query;

    if (await getUserAccessToken(email)) {
        query = 'UPDATE user_access_tokens SET access_token = ? , created = ? , ttl = ? WHERE email=?';
    } else {
        query = 'INSERT INTO user_access_tokens ( access_token, created, ttl, email ) VALUES ( ?, ?, ?, ? )';
    }

    await db.execute(query, [ accessToken, created, ttl, email ], { prepare: true });
}

async function revokeUserAccessToken(email) {
    const query = 'DELETE FROM user_access_tokens WHERE email = ?';
    await db.execute(query, [ email ]);
}

async function getUserRegistrationTokens() {
    const query = 'SELECT * FROM user_registration_tokens';
    const result = await db.execute(query);
    return result.rows;
}

async function getUserRegistrationToken(email) {
    const query = 'SELECT * FROM user_registration_tokens WHERE email = ?';
    const result = await db.execute(query, [ email ]);
    if (result.rows[0]) return result.rows[0];
    return null;
}

async function createUserRegistrationToken(email, registrationToken, created, ttl) {
    let query;

    if (await getUserRegistrationToken(email)) {
        query = 'UPDATE user_registration_tokens SET registration_token = ? , created = ? , ttl = ? WHERE email=?';
    } else {
        query = 'INSERT INTO user_registration_tokens ( registration_token, created, ttl, email ) VALUES ( ?, ?, ?, ? )';
    }

    await db.execute(query, [ registrationToken, created, ttl, email ], { prepare: true });
}

async function revokeUserRegistrationToken(email) {
    const query = 'DELETE FROM user_registration_tokens WHERE email = ?';
    await db.execute(query, [ email ]);
}

module.exports = {
    getUsers,
    getUser,
    getAdmins,
    getAdmin,
    getAdminAccessTokens,
    getAdminAccessToken,
    createAdminAccessToken,
    revokeAdminAccessToken,
    getUserAccessTokens,
    getUserAccessToken,
    createUserAccessToken,
    revokeUserAccessToken,
    getUserRegistrationTokens,
    getUserRegistrationToken,
    createUserRegistrationToken,
    revokeUserRegistrationToken
};