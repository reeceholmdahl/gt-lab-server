/**
 * Common format for how this API sends error messages to the client
 * @param  {...string} messages A list of errors that occured to send to the client
 * @returns JSON object with all the messages keyed to 'messages'
 */
module.exports = (...messages) => {
    return {
        messages
    }
}