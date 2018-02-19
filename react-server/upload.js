const formidable = require('formidable'),
    fs = require('fs-extra'),
    path = require('path'),
    uploadDir = process.env.UPLOAD_FOLDER_DIR,
    tempDir = './public/tmp';

function folderIsExit(folder) {
    return new Promise(async (resolve, reject) => {
        let result = await fs.ensureDirSync(path.join(folder));
        resolve(true);
    })
}

function handleUpload(req, res) {
    let form = new formidable.IncomingForm();
    form.uploadDir = path.join(tempDir);
    form.keepExtensions = true;
    form.parse(req, function(err, fields, file) {
        let filePath = '';
        if (file.filepath) {
            filePath = file.filepath.path;
        } else {
            for (var key in file) {
                if (file[key].path && filePath === '') {
                    filePath = file[key].path;
                    break;
                }
            }
        }
        const targetDir = path.join(`./${uploadDir}/${fields.fileMd5}`);
        folderIsExit(targetDir)
            .then(val => {
                // var fileExt = filePath.substring(filePath.lastIndexOf('.'));
                // if (('.jpg.jpeg.png.gif.psd').indexOf(fileExt.toLowerCase()) === -1) {
                //     console.log('filetype is not match')
                //     var err = new Error('this file can not accept);
                //     return res.json({
                //         status:0,
                //         message:'file not accept'
                //     });
                // } 
                let targetFile = path.join(targetDir, fields.chunkMd5);
                fs.rename(filePath, targetFile, function(err) {
                    if (err) {
                        res.json({
                            Code: 201,
                            message: 'Upload file failed'
                        });
                    } else {
                        res.json({
                            Code: 200,
                            message: 'Upload file successfully'
                        });
                    }
                });
            });
    });
}
module.exports = handleUpload