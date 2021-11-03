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
    // throw new Error(`Could not retrieve user with email '${email}' from database`);
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
    // throw new Error(`Could not retrieve admin with email '${email}' from database`);
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
    // throw new Error(`Could not retrieve any admin token with email '${email}' from database`);
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

async function revokeAdminAccessToken(email) {
    const query = 'DELETE FROM admin_access_tokens WHERE email = ?';
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
    revokeAdminAccessToken
};