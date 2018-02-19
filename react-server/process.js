const fs = require('fs');
const readLine = require('readline');

const maping = new Set(['A', 'B', 'E', 'H', 'R', 'r', 'I', 'J', 'P', 'X']);

function promiseLines(path) {
    return new Promise((resolve, reject) => {
        const lines = {};
        let lineReader;
        try {
            lineReader = readLine.createInterface({
                input: fs.createReadStream(path),
            });
        } catch (error) {
            reject(error);
        }

        lineReader.on('line', (line) => {
            if (!line || line[0] !== 'S' || !maping.has(line[9])) {
                return; //or regex to check line
            }
            let msgType = line[9];
            if (!lines[msgType]) {
                lines[msgType] = 1
            } else {
                lines[msgType]++;
            }
        });

        lineReader.on('close', () => resolve(lines));
    });
}

module.exports = promiseLines;