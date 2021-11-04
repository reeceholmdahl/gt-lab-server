const db = require('./db/cassandra.js');
const server = require('./server.js');
const api = require('./geotab/init.js');
const getDrivingData = require('./geotab/driving-data.js');

server.start();

async function testGeotab() {
    const data = await getDrivingData('bB', new Date('11/03/21 18:00:00'), new Date());
    console.log(data);
}

testGeotab();