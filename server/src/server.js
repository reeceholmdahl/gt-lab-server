const express = require('express');
const admin = require('./admin/admin.js');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/admin', admin);

app.use('/api/user', (req, res) => {
    res.send('Hello, user');
});

function start(port = 4000) {
    app.listen(port, () => console.log(`Server listening on port ${port}...`));
}

module.exports = {
    start
};