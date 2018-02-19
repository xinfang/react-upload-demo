let dotenv = require('dotenv').config();
let express = require('express');
let fs = require('fs-extra');
let path = require('path');
let concat = require('concat-files')
let cors = require('cors');
let bodyParser = require('body-parser');
let handleUpload = require('./upload.js');
let promiseLines = require('./process.js');
let app = express();

const uploadDir = process.env.UPLOAD_FOLDER_DIR;

process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => res.send("Hello React Demo!"));
app.post("/upload", handleUpload);
app.post("/process", processFiles);
app.post("/verify", (req, res) => {
    verify(req.body, data => {
        res.send(data);
    });
});
app.post("/getChunkInfo", (req, res) => {
    getChunkList(req.body, data => {
        res.send(data);
    });
});

async function processFiles(req, res) {
    try {
        const filePath = path.join(uploadDir, req.body.fileMd5 + '.txt'),
            result = await promiseLines(filePath),
            arr = [];
        Object.keys(result).forEach((type, index) => {
            arr.push({
                key: index,
                msgType: type,
                count: result[type]
            });
        });
        res.send(arr);
    } catch (error) {
        res.send({
            Code: 201,
            Desc: 'Process file error'
        });
    }
}

async function verify(body, callback) {
    let folderPath = path.resolve(__dirname, uploadDir, body.file.fileMd5);
    let isFolderExist = await isFolder(folderPath);
    let fileList = [];
    if (isFolderExist) {
        fileList = await listDir(folderPath);
    }
    if (fileList.length !== body.file.fileChunks) {
        return callback({
            Code: 201
        });
    }
    mergerFile(body.chunks, folderPath , callback);
}

async function getChunkList(body, callback) {
    let fileInfo = body.file,
        isExit = await isFileExist(path.join(uploadDir, fileInfo.fileMd5 + '.txt'));
    if (isExit) {
        return callback({
            Code: 200,
            FileStatus: true
        });
    }
    let folderPath = path.resolve(__dirname, uploadDir, fileInfo.fileMd5),
        isFolderExist = await isFolder(folderPath),
        fileList = [];
    if (isFolderExist) {
        fileList = await listDir(folderPath);
    }
    if (fileList.length === fileInfo.fileChunks) {
        return mergerFile(body.chunks, folderPath, callback);
    }
    callback({
        Code: 200,
        FileMd5: fileInfo.fileMd5,
        MaxThreads: 1,
        Message: "OK",
        Total: fileInfo.fileChunks,
        Uploaded: fileList.length,
        Chunks: body.chunks.reduce((acc, cur) => {
            acc.push({
                ...cur,
                'fileMd5': fileInfo.fileMd5,
                'status': !~fileList.indexOf(cur.chunkMd5) ? 'Pending' : 'Uploaded'
            });
            return acc;
        }, [])
    })
}

function mergerFile(chunks, folderPath, callback) {
    let fileArr = chunks.map(chunk => path.join(folderPath, chunk.chunkMd5));
    concat(fileArr, folderPath + '.txt', (err) => {
        if (err) {
            return callback({
                Code: 201
            });
        }
        fs.remove(folderPath, err => {
            if (err) {
                return callback({
                    Code: 201
                });
            }
            callback({
                Code: 200,
                FileStatus: true
            });
        })
    })
}

function isFileExist(filePath) {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
            if ((err && err.code === "ENOENT") || !stats.isFile()) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

function isFolder(filePath) {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
            if ((err && err.code === "ENOENT") || !stats.isDirectory()) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

function listDir(path) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            if (data && data.length > 0 && data[0] === ".DS_Store") {
                data.splice(0, 1);
            }
            resolve(data);
        });
    });
}

app.listen(process.env.PORT);
console.log("Listening on port " + process.env.PORT);