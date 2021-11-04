const _api = require('./init.js');

const ACC_X_EVENTS_ID = 'DiagnosticAccelerationForwardBrakingId';
const ACC_Y_EVENTS_ID = 'DiagnosticAccelerationSideToSideId'

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
    ).then(trips => response.trips = trips);

    await Promise.all([
        (response.forward_braking_events = await fetchEngineData(ACC_X_EVENTS_ID)),
        (response.cornering_events =await  fetchEngineData(ACC_Y_EVENTS_ID)),
        (response.trips = await fetchTrips)
    ]);

    console.log(response);
}

module.exports = getDrivingData;