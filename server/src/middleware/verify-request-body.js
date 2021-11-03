const errorMessage = require('../util/error-msg.js');

/**
 * # Verify Request Body
 * 
 * Has automatic type conversion for:
 * * String to Date
 * 
 * Failure Codes
 * * 400 - any key (recursively) in 'expectedRequestBody' is missing in req.body of the request this middleware is used on
 * * 400 - could not convert data type
 * 
 * @param {ObjectConstructor} expectedRequestBody The object constructor (basically an interface) of the expected request body
 * @returns A middleware that will verify the request body and give feedback to augment the body on failure
 */
module.exports = (expectedRequestBody) => async (req, res, next) => {

    const errors = [];

    function recursiveCheck(sample, actual, path = '') {

        for (let key of Object.keys(sample)) {

            /** 
             * Because keys in 'expectedRequestBody' are technically ctors, they must be called with () to
             * check their type against the actual request body. This is the case unless the sample key in
             * question is an object itself, in which case it cannot be called.
             */
            const expectedKeyType = typeof (sample[key] instanceof Function ? sample[key]() : sample[key]);

            // If the actual object does not contain this key
            if (!(key in actual)) {

                // Object does not contain key
                errors.push(`The request body does not contain the key '${path}${key}'`);

            } 
            
            // If the actual object contains this key, but it is valueless (but not === 0)
            // TODO if application requires the passing of empty arrays or empty strings this must be changed
            else if (actual[key] !== 0 && !actual[key]) {

                // Object key is null or empty
                errors.push(`The value of key '${path}${key}' is null or empty`);

            }
            
            // If the actual key type is equal to the expected key type
            else if (typeof actual[key] !== expectedKeyType) {

                // Object key is not the type expected
                errors.push(`The value of key '${path}${key}' is a ${typeof actual[key]} when a ${expectedKeyType} was expected`);            
            }
            
            // If the key type for the actual and sample object is an object, recurse
            else if (actual[key] instanceof Object) {

                // Recursively check this key as an object against its sample
                recursiveCheck(sample[key], actual[key], `${path}${key}.`);

            }

            // Selective type conversion
            const save = actual[key];
            try {
                switch (sample[key]) {
                    case Date:
                        actual[key] = new Date(actual[key]);
                        if (!actual[key].toJSON()) throw new Error(`${actual[key]} is not a valid date`);
                        break;

                    default:
                        // Do nothing
                        break;
                }
            } catch {
                // Could not convert the key to the type
                actual[key] = save;
                errors.push(`Could not convert ${actual[key]} from ${typeof actual[key]} to ${sample[key].name}`);
            }
        }
    }

    // Call the recursive key check of the request body against the expected request body
    recursiveCheck(expectedRequestBody, req.body);

    // If there are no errors, go to the next route handler
    if (errors.length === 0) {
        next();
    }
    
    // If there are errors, send a status 400 along with the array of error messages
    else {
        res.status(400).send(errorMessage(...errors));
    }
};