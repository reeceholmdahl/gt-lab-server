const drivingData = require('../geotab/driving-data.js');
const arrayToCSV = require('../util/array-to-csv.js');
const path = require('path');
const fs = require('fs/promises');

module.exports = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();
    const sixTonight = new Date(`${month}/${day}/${year} 18:00:00 CST`);

    let wait;
    if (now > sixTonight) {
        wait = sixTonight.getTime() - now.getTime() + 24 * 60 * 60 * 1000;
        log();
    } else {
        wait = sixTonight.getTime() - now.getTime();
    }

    let interval;
    const timeout = setTimeout(() => {

        interval = setInterval(() => {
            log();
        }, 24 * 60 * 60 * 1000);

    }, wait);
};

async function log(from, to) {

    console.log(`Logging all vehicle data from ${from} to ${to}`);

    to = to ?? new Date();
    from = from ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const vehicles = await drivingData.getVehicles();

    const csvFolder = path.resolve('csv');
    const dateFolderName = `${to.getMonth() + 1}-${to.getDate()}-${to.getFullYear()}`;
    await fs.mkdir(path.join(csvFolder, dateFolderName));
    const dateFolder = path.resolve(csvFolder, dateFolderName);


    vehicles.forEach(async vehicle => {

        await fs.mkdir(path.join(dateFolder, vehicle.name));
        const location = path.resolve(dateFolder, vehicle.name);
        
        drivingData.getAccXEvents(vehicle.id, from, to).then(events => {
            const csv = arrayToCSV(events);
            fs.writeFile(path.join(location, 'acc_x_events.csv'), csv);
        });

        drivingData.getAccYEvents(vehicle.id, from, to).then(events => {
            const csv = arrayToCSV(events);
            fs.writeFile(path.join(location, 'acc_y_events.csv'), csv);
        });

        drivingData.getTrips(vehicle.id, from, to).then(trips => {
            const csv = arrayToCSV(trips);
            fs.writeFile(path.join(location, 'trips.csv'), csv);
        });

        drivingData.getSpeedingEvents(vehicle.id, from, to).then(events => {
            const csv = arrayToCSV(events);
            fs.writeFile(path.join(location, 'speeding_events.csv'), csv);
        });

    });
}

module.exports.log = log;