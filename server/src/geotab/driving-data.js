const _api = require('./init.js');
const arrayToCSV = require('../util/array-to-csv.js');

const ACC_X_EVENTS_ID = 'DiagnosticAccelerationForwardBrakingId';
const ACC_Y_EVENTS_ID = 'DiagnosticAccelerationSideToSideId';

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
            dateTime: new Date(event.dateTime).toISOString(),
            value: event.data,
            type: event.diagnostic.id,
            id: event.device.id
        };
    }));
}

/**
 * 
 * @param {string} vehicle The id of the vehicle
 * @param {Date} from Start of date range
 * @param {Date} to End of date range
 */
async function getAccXEvents(vehicle, from, to) {

    // Get the Geotab API object
    const api = await _api;

    // Fetch engine data functon
    return await fetchEngineData(api, from, to, vehicle, ACC_X_EVENTS_ID);

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
    return await fetchEngineData(api, from, to, vehicle, ACC_Y_EVENTS_ID);

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

    const fetchTrips = api.call(
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
    ).then(trips => response.trips = trips.map(trip => {
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
            average_speed: trip.averageSpeed
        };
    }));
}

/**
 * 
 * @param {string} vehicle The id of the vehicle to retrieve driving data about
 * @param {Date} from Start of date range of driving data to retrieve
 * @param {Date} to End of date range of driving data to retrieve
 */
async function getDrivingData(vehicle, from, to) {
    
    const api = await _api;
    
    async function fetchEngineData(diagnosticId) {
        return api.call(
            'Get',
            {
                typeName: 'StatusData',
                resultsLimit: '50000',  // maximum results
                search: {
                    fromDate: from.toISOString(),
                    toDate: to.toISOString(),
                    diagnosticSearch: {
                        id: diagnosticId
                    },
                    deviceSearch: {
                        id: vehicle
                    }
                }
            }
        ).then(events => events.map(event => {
            return {
                dateTime: new Date(event.dateTime).toISOString(),
                value: event.data,
                type: event.diagnostic.id,
                id: event.device.id,
            };
        }));
    }

    const response = {
        forward_braking_events: [],
        cornering_events: [],
        trips: []
    }

    const fetchForwardBrakingEvents = fetchEngineData(ACC_X_EVENTS_ID)
    .then(events => response.forward_braking_events = events);

    const fetchCorneringEvents = fetchEngineData(ACC_Y_EVENTS_ID)
    .then(events => response.cornering_events = events);

    const fetchTrips = api.call(
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
    ).then(trips => response.trips = trips.map(trip => {
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
            average_speed: trip.averageSpeed
        };
        // return trip;
    }));

    await Promise.all([
        fetchForwardBrakingEvents,
        fetchCorneringEvents,
        fetchTrips
    ]);

    return response;
}

module.exports = {
    getAccXEvents,
    getAccYEvents,
    getSpeedingEvents,
    getTrips,
    arrayToCSV
};