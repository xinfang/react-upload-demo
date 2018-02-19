import React, { Component } from 'react';
import axios from 'axios';
import SparkMD5 from 'spark-md5';
import { Upload, Icon, Progress, Modal, Spin, message } from 'antd';
import ResultTable from './ResultTable';
import ButtonUpload from './ButtonUpload';

const { confirm } = Modal,
    { Dragger } = Upload,
    ServerHost = process.env.REACT_APP_BASE_URL;

class FileUpload extends Component {
    constructor(props) {
        super(props);
        this.state = {
            buttonDisabled: false,
            preUploading: false,
            chunksSize: 0,
            currentChunks: 0,
            uploadPercent: -1,
            preUploadPercent: -1,
            uploadRequest: false,
            uploaded: false,
            uploading: false,
            processResult: []
        };
    }
    showConfirm = () => {
        const vm = this;
        confirm({
            title: 'Confirme to upload?',
            content: 'Please click OK button to confirme!',
            onOk() {
                vm.preUpload();
            },
            onCancel() {}
        });
    };
    reProcessConfirm = () => {
        const vm = this;
        confirm({
            title: 'The file already exists. Do you want to reprocess it?',
            content: 'Please click OK button to confirme!',
            onOk() {
                vm.processFile();
            },
            onCancel() {
                this.setState({
                    buttonDisabled: false
                });
            }
        });
    };
    processFile = () => {
        axios.post(`${ServerHost}/process`, {
            fileMd5: this.state.uploadParams.file.fileMd5
        }).then((res) => {
            // if (res.data.Code !== 200) {
            //     message.error('Failed to process file.');
            //     return;
            // }
            this.setState({
                buttonDisabled: false,
                processResult: res.data
            });
        }).catch(err => console.log(err));
    };
    verify = () => {
        axios.post(`${ServerHost}/verify`, this.state.uploadParams)
            .then((res) => {
                if (res.data.Code !== 200) {
                    this.setState({
                        buttonDisabled: false
                    });
                    message.error('File upload failed, please check log for details.');
                    return;
                }
                this.processFile();
            }).catch(err => console.log(err));
    };
    preUpload = () => {
        this.setState({
            buttonDisabled: true
        });
        axios.post(`${ServerHost}/getChunkInfo`, this.state.uploadParams)
            .then((res) => {
                if (res.data.Code === 200 && res.data.FileStatus) {
                    this.setState({
                        uploaded: true,
                        uploading: false
                    });
                    this.reProcessConfirm();
                    return;
                }
                const { data } = res,
                    uploadList = data.Chunks.filter(chunk => chunk.status === 'Pending'),
                    currentChunks = data.Total - data.Uploaded,
                    uploadPercent = Number((
                        ((this.state.chunksSize - currentChunks) / this.state.chunksSize) * 100
                    ).toFixed(2)),
                    uploadStatus = uploadPercent === 100;
                this.setState({
                    uploaded: uploadStatus,
                    uploading: !uploadStatus,
                    uploadRequest: false,
                    currentChunks,
                    uploadPercent
                });
                if (uploadStatus) {
                    message.success('File Uploaded Successfully');
                }
                this.handlePartUpload(uploadList);
            }).catch(err => console.log(err));
    };
    handlePartUpload = (uploadList) => {
        uploadList.forEach((value) => {
            const {
                    fileMd5,
                    chunkMd5,
                    chunk,
                    start,
                    end 
                } = value,
                formData = new FormData(),
                blob = new Blob([this.state.arrayBufferData[chunk - 1].currentBuffer], {
                    type: 'application/octet-stream'
                }),
                params = `fileMd5=${fileMd5}&chunkMd5=${chunkMd5}&chunk=${chunk}&start=${start}&end=${end}&chunks=${
                    this.state.arrayBufferData.length
                }`;
            formData.append('chunk', blob, chunkMd5);
            formData.append('fileMd5', fileMd5);
            formData.append('chunkMd5', chunkMd5);
            axios.post(`${ServerHost}/upload?${params}`, formData)
                .then((res) => {
                    if (res.data.Code !== 200) {
                        console.log('file upload failed.');
                        this.setState({
                            buttonDisabled: false
                        });
                        return;
                    }
                    let { currentChunks } = this.state;
                    currentChunks -= 1;
                    const uploadPercent = Number((
                        ((this.state.chunksSize - currentChunks) / this.state.chunksSize) * 100
                    ).toFixed(2));
                    this.setState({
                        currentChunks,
                        uploadPercent,
                        uploading: true
                    });
                    if (currentChunks === 0) {
                        this.verify();
                        this.setState({
                            uploading: false,
                            uploaded: true
                        });
                        message.success('The file has been successfully uploaded!');
                    }
                }).catch(err => console.log(err));
        });
    };
    render() {
        const {
                preUploading,
                uploadPercent,
                preUploadPercent,
                uploadRequest,
                uploaded,
                uploading,
                processResult,
                buttonDisabled
            } = this.state,
            _this = this,
            uploadProp = {
                onRemove: (file) => {
                    this.setState(({ fileList }) => {
                        const index = fileList.indexOf(file),
                            newFileList = fileList.slice();
                        newFileList.splice(index, 1);
                        return {
                            uploaded: false,
                            uploading: false,
                            uploadRequest: false,
                            preUploadPercent: -1,
                            fileList: newFileList
                        };
                    });
                },
                beforeUpload: (file) => {
                    if (file.type && file.type !== 'text/plain') {
                        message.error('Uploaded file is not a valid file. Only text plain files are allowed');
                        return false;
                    }
                    this.setState({
                        uploaded: false,
                        uploading: false,
                        uploadRequest: false
                    });

                    const blobSlice =
                        File.prototype.slice ||
                        File.prototype.mozSlice ||
                        File.prototype.webkitSlice,
                        chunkSize = 1024 * 1024 * 5,
                        chunks = Math.ceil(file.size / chunkSize),
                        spark = new SparkMD5.ArrayBuffer(),
                        chunkFileReader = new FileReader(),
                        totalFileReader = new FileReader(),
                        params = { chunks: [], file: {} },
                        arrayBufferData = [];
                    let currentChunk = 0;

                    function loadNext() {
                        const start = currentChunk * chunkSize,
                            end = start + chunkSize >= file.size ? file.size : start + chunkSize;
                        chunkFileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
                    }

                    params.file.fileName = file.name;
                    params.file.fileSize = file.size;

                    totalFileReader.readAsArrayBuffer(file);
                    totalFileReader.onload = function totalOnload(e) {
                        spark.append(e.target.result);
                        params.file.fileMd5 = spark.end();
                    };

                    chunkFileReader.onload = function chunkOnload(e) {
                        spark.append(e.target.result);
                        const obj = {
                                chunk: currentChunk + 1,
                                start: currentChunk * chunkSize,
                                end: (currentChunk * chunkSize) + chunkSize >= file.size
                                    ? file.size
                                    : (currentChunk * chunkSize) + chunkSize,
                                chunkMd5: spark.end(),
                                chunks
                            },
                            tmp = {
                                chunk: obj.chunk,
                                currentBuffer: e.target.result
                            };
                        currentChunk += 1;
                        params.chunks.push(obj);
                        arrayBufferData.push(tmp);

                        if (currentChunk < chunks) {
                            loadNext();
                            _this.setState({
                                preUploading: true,
                                preUploadPercent: Number(((currentChunk / chunks) * 100).toFixed(2))
                            });
                        } else {
                            params.file.fileChunks = params.chunks.length;
                            _this.setState({
                                preUploading: false,
                                uploadParams: params,
                                arrayBufferData,
                                chunksSize: chunks,
                                preUploadPercent: 100
                            });
                        }
                    };

                    chunkFileReader.onerror = function chunkReader() {
                        console.warn('oops, something went wrong.');
                    };

                    loadNext();

                    this.setState({
                        fileList: [file],
                        file: file
                    });
                    return false;
                },
                //  accept: 'text/plain',
                fileList: this.state.fileList
            };

        return (
            <div className="content-inner">
                <Spin
                    tip={
                        <div>
                            <h3 style={{ margin: '10px auto', color: '#1890ff' }}>
                                file preparation
                            </h3>
                            <Progress
                                width={80}
                                percent={preUploadPercent}
                                type="circle"
                                status="active"
                            />
                        </div>
                    }
                    spinning={preUploading}
                    className="Loading-Spin"
                    style={{ height: 350 }}
                >
                    <div style={{ marginTop: 16, height: 250 }}>
                        <Dragger {...uploadProp}>
                            <p className="ant-upload-drag-icon">
                                <Icon type="inbox" />
                            </p>
                            <p className="ant-upload-text">
                                Click or drag file to this area to upload
                            </p>
                            <p className="ant-upload-hint">
                                Support for a single or bulk upload. Strictly prohibit from
                                uploading company data or other band files
                            </p>
                        </Dragger>
                        {uploadPercent >= 0 && !!uploading && (
                            <div style={{ marginTop: 20, width: '95%' }}>
                                <Progress
                                    percent={uploadPercent}
                                    status="active"
                                />
                                <h4>Uploading....，Do not close window.</h4>
                            </div>
                        )}
                        {!!uploadRequest && (
                            <h4 style={{ color: '#1890ff' }}>Uploading...</h4>
                        )}
                        {!!uploaded && (
                            <h4 style={{ color: '#52c41a' }}>File uploaded successfully!</h4>
                        )}
                        {!!uploaded && (
                            <ResultTable dataSource={processResult} />
                        )}
                        {preUploadPercent === 100 && (
                            <ButtonUpload 
                                showConfirm={this.showConfirm}
                                disabled = {buttonDisabled}
                            />
                        )}
                    </div>
                </Spin>
            </div>
        );
    }
}

export default FileUpload;