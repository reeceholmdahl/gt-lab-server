const db = require('./db/cassandra.js');
const server = require('./server.js');
const api = require('./geotab/init.js');
const drivingData = require('./geotab/driving-data.js');
const path = require('path');
const fs = require('fs/promises');

server.start();

async function test() {
    
    console.log(await drivingData.deviceIdFromName('Slime'));
    // console.log(await drivingData.getTrips('bB', new Date('11/19/2021 12:00:00'), new Date('11/23/2021 18:00:00')));
    
}

// test();