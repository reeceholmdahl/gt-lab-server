const db = require('./db/cassandra.js');
const server = require('./server.js');
const api = require('./geotab/init.js');
const drivingData = require('./geotab/driving-data.js');
const path = require('path');
const fs = require('fs/promises');

server.start();

async function testGeotab() {
    // const data = await getDrivingData('bB', new Date('11/03/21 18:00:00'), new Date());
    // const data = await drivingData.getSpeedingEvents('bB', new Date('11/17/21 18:00:00'), new Date('11/19/21 18:00:00'));

    const stuff = drivingData.arrayToCSV(await drivingData.getSpeedingEvents('bB', new Date('11/17/21 14:00:00'), new Date('11/20/21 14:00:00')));

    fs.writeFile(path.resolve('./server/test/speeding.csv'), stuff);
    
}

testGeotab();