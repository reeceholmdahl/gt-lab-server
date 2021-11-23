const express = require('express');
const serveIndex = require('serve-index');
const serveStatic = require('serve-static');
const admin = require('./routes/admin.js');
const user = require('./routes/user.js');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/admin', admin);

app.use('/api/user', user);

const csvPath = path.resolve(__dirname, '../../csv');
app.use('/csv', admin.verifyAccessToken, serveIndex(csvPath), serveStatic(csvPath));

function start(port = 4000) {
    app.listen(port, () => console.log(`Server listening on port ${port}...`));
}

module.exports = {
    start,
    get app() { return app }
};