const _api = require('./init.js');

const ACC_X_EVENTS_ID = 'DiagnosticAccelerationForwardBrakingId';
const ACC_Y_EVENTS_ID = 'DiagnosticAccelerationSideToSideId';

async function getVehicles() {

    const api = await _api;

    return (await api.call('Get', { typeName: 'Device' })).map(device => new Object({ id: device.id, name: device.name }));
}

async function deviceIdFromName(name) {

    const api = await _api;

    return (await api.call('Get', { typeName: 'Device', search: { name } }))[0]?.id;
}

/**
 * @param api The GeotabApi object
 * @param {string} vehicle The id of the vehicle
 * @param {Date} from Start of date range
 * @param {Date} to End of date range
 * @param {string} diagnosticId The diagnostic ID of the engine status data to retrieve
 */
async function fetchEngineData(api, vehicle, from, to, diagnosticId) {
    return api.call(
        'Get',
        {

            // API Object this data falls under
            typeName: 'StatusData',
            resultsLimit: '50000',  // maximum results

            // Search object for narrowing results
            search: {

                // Data range
                fromDate: from.toISOString(),
                toDate: to.toISOString(),

                // The kind of search to make
                diagnosticSearch: {
                    id: diagnosticId
                },

                // The vehicle to search under
                deviceSearch: {
                    id: vehicle
                }
            }
        }
    ).then(events => events.map(event => {

        // Cleans up the diagnostic engine data to what we need
        return {
            date: new Date(event.dateTime).toISOString(),
            value: event.data,
            // type: event.diagnostic.id,
            // id: event.device.id
        };
    }));
}

/**
 * 
 * @param {string} vehicle The name of the vehicle
 * @param {Date} from Start of date range
 * @param {Date} to End of date range
 */
async function getAccXEvents(vehicle, from, to) {

    // Get the Geotab API object
    const api = await _api;

    // Fetch engine data functon
    return await fetchEngineData(api, vehicle, from, to, ACC_X_EVENTS_ID);

}

/**
 * 
 * @param {string} vehicle The id of the vehicle
 * @param {Date} from Start of date range
 * @param {Date} to End of date range
 */
async function getAccYEvents(vehicle, from, to) {
    
    // Get the Geotab API object
    const api = await _api;

    // Fetch engine data functon
    return await fetchEngineData(api, vehicle, from, to, ACC_Y_EVENTS_ID);

}

/**
 * 
 * @param {string} vehicle The id of the vehicle
 * @param {Date} from Start of date range
 * @param {Date} to End of date range
 */
async function getSpeedingEvents(vehicle, from, to) {

    function objectEquals(obj1, obj2) {
        for (const key of Object.keys(obj1)) {
            if (obj1[key] instanceof Object) {
                if (!objectEquals(obj1[key], obj2[key])) return false;
            }

            if (obj1[key] !== obj2[key]) return false;
        }
        return true;
    }

    // Get the Geotab API object
    const api = await _api;

    // Empty array to be filled with individual API calls to get the location and speed during a speeding exception
    const promises = [];

    const events = (await api.call(
        'Get',
        {
            // API Object this data falls under
            typeName: 'ExceptionEvent',
            resultsLimit: '50000',  // maximum results

            // Search object for narrowing results
            search: {

                // Data range
                fromDate: from.toISOString(),
                toDate: to.toISOString(),

                // The kind of search to make
                ruleSearch: {
                    name: 'SpeedingNew'
                },

                // The vehicle to search under
                deviceSearch: {
                    id: vehicle
                }
            }
        }
    )).map((event, index) => {

        promises.push(api.call(
            'Get',
            {
                // API Object this data falls under
                typeName: 'LogRecord',
                resultsLimit: '50000',  // maximum results

                // Search object for narrowing results
                search: {

                    // Data range
                    fromDate: event.activeFrom,
                    toDate: event.activeTo,

                    // The vehicle to search under
                    deviceSearch: {
                        id: vehicle
                    }
                }
            }
        ).then(logs => {
            events[index].averageSpeed = logs.reduce((acc, value) => acc + value.speed, 0) / logs.length;
            let { latitude, longitude } = logs[0];
            events[index].start = { latitude, longitude };
            ({ latitude, longitude } = logs[logs.length - 1]);
            events[index].end = { latitude, longitude };
        }));

        const split = event.duration.split(':').flatMap(part => part.split('.'));
        const hours = parseInt(split[0] ?? 0);
        const minutes = parseInt(split[1] ?? 0);
        const seconds = parseInt(split[2] ?? 0);

        return {
            from: event.activeFrom,
            to: event.activeTo,
            duration: {
                hours,
                minutes,
                seconds
            },
            distance: event.distance,
            start: null,
            end: null,
            averageSpeed: null,
        };
    });

    await Promise.all(promises);

    return events.filter((event, index, events) => {

        // Doesn't properly get rid of duplicates yet
        return !(events[index - 1] && objectEquals(events[index - 1], event)) && !(events[index].averageSpeed == 0);
    });
}

/**
 * 
 * @param {string} vehicle The id of the vehicle
 * @param {Date} from Start of date range
 * @param {Date} to End of date range
 */
async function getTrips(vehicle, from, to) {

    // Get the Geotab API object
    const api = await _api;

    const trips = await api.call(
        'Get',
        {
            typeName: 'Trip',
            resultsLimit: 50000,
            search: {
                fromDate: from.toISOString(),
                toDate: to.toISOString(),
                deviceSearch: {
                    id: vehicle
                }
            }
        }
    );

    return trips.map(trip => {
        const split = trip.drivingDuration.split(':').flatMap(part => part.split('.'));
        const hours = parseInt(split[0] ?? 0);
        const minutes = parseInt(split[1] ?? 0);
        const seconds = parseInt(split[2] ?? 0);
        return {
            start: trip.start,
            stop: trip.stop,
            duration: {
                hours,
                minutes,
                seconds
            },
            distance: trip.distance,
            averageSpeed: trip.averageSpeed
        };
    });
}

module.exports = {
    getVehicles,
    deviceIdFromName,
    getAccXEvents,
    getAccYEvents,
    getSpeedingEvents,
    getTrips,
};