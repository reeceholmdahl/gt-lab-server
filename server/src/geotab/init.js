const GeotabApi = require('mg-api-js');

const api = new GeotabApi({
    credentials: {
        userName: 'whit2439@d.umn.edu',
        password: 'MainsFrames22',
        database: 'mdu'
    }
});

module.exports = api.authenticate().then(result => api);