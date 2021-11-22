module.exports = (array) => {

    function flatKeys(obj, path = "") {
        let header = "";

        for (const key of Object.keys(obj)) {

            if (obj[key] instanceof Object) header += flatKeys(obj[key], `${key}_`);
            else header += path + key + ",";
        }
        return header;
    }

    function flatValues(obj) {
        let values = [];

        for (const key of Object.keys(obj)) {

            if (obj[key] instanceof Object) values.push(...flatValues(obj[key]));
            else values.push(obj[key]);
        }
        return values;
    }

    const csv = flatKeys(array[0])                      // header
        + array.map(flatValues).reduce((acc, curr) => { // convert and flatten data to csv
            return acc + '\n' + curr.join(',');
        }, '');

    return csv;
};