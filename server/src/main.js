const db = require('./db/cassandra.js');
const server = require('./server.js');
const api = require('./geotab/init.js');
const drivingData = require('./geotab/driving-data.js');
const logger = require('./logger/logger.js');

function keepOn() {
    try {

        logger();

        server.start();

    } catch {
        keepOn();
    }
}

keepOn();

async function test() {
    
    console.log(await drivingData.getVehicles());
    logger.log(new Date('11/21/2021 18:00:00 CST'), new Date('11/22/2021 18:00:00 CST'));
    // console.log(await drivingData.getTrips('bB', new Date('11/19/2021 12:00:00'), new Date('11/23/2021 18:00:00')));
}

// test();