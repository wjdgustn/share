const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const uniqueString = require('unique-string');
const streamifier = require('streamifier');
const fs = require('fs');

const File = require('../schemas/file');

const setting = require("../setting.json");

const app = express.Router();

const limiter = rateLimit({
    windowMs: 1000 * 60,
    max: 5,
    message: "<script>alert('1분에 5개만 업로드 가능합니다.');location.href = '/';</script>",
    skip: (req, res) => {
        if(setting.BYPASS_LIMIT.indexOf(res.locals.ip) == -1) return false;
        else return true;
    }
});

const upload = multer({
    storage: multer.memoryStorage()
});

app.get('/', limiter, (req, res, next) => {
    return res.render('main');
});

app.get('/check', (req, res, next) => {
    return res.send(setting.BYPASS_LIMIT.includes(res.locals.ip) ? '용량, rate limit 제한을 받지 않습니다.' : '용량, rate limit 제한을 받습니다.');
});

app.post('/upload', upload.single('file'), async (req, res, next) => {
    if(!setting.BYPASS_LIMIT.includes(res.locals.ip) && req.file.size > 1024 * 1024 * 1024) {
        req.flash('Error', '파일이 1GB를 초과합니다.');
        return res.redirect('/');
    }

    const filename = `${uniqueString()}${path.extname(req.file.originalname)}`;
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    const secretkey = `${uniqueString()}${uniqueString()}`;

    streamifier.createReadStream(req.file.buffer).pipe(fs.createWriteStream(path.join(setting.SAVE_FILE_PATH, filename)));

    await File.create({
        filename,
        secretkey,
        limit: limit.getTime(),
        originalname: req.file.originalname
    });

    req.flash('Info', `파일이 업로드되었습니다! 링크를 잘 보관해주세요. 링크가 없으면 다운로드가 불가능합니다.<br>${req.protocol}://${req.hostname}/download?filename=${filename}&secret=${secretkey}`);
    return res.redirect('/');
});

app.get('/download', async (req, res, next) => {
    const file = await File.findOne({
        filename: req.query.filename
    });
    if(!file || file.secretkey != req.query.secret) {
        req.flash('Error', '해당 파일을 찾을 수 없습니다. URL을 확인하세요.');
        return res.redirect('/');
    }
    return res.download(path.join(setting.SAVE_FILE_PATH, file.filename), file.originalname);
});

app.post('/api/upload', upload.single('file'), async (req, res, next) => {
    if(!setting.BYPASS_LIMIT.includes(res.locals.ip) && req.file.size > 1024 * 1024 * 1024)
        return res.send('파일이 1GB를 초과합니다.');

    const filename = `${uniqueString()}${path.extname(req.file.originalname)}`;
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    const secretkey = `${uniqueString()}${uniqueString()}`;

    streamifier.createReadStream(req.file.buffer).pipe(fs.createWriteStream(path.join(setting.SAVE_FILE_PATH, filename)));

    await File.create({
        filename,
        secretkey,
        limit: limit.getTime(),
        originalname: req.file.originalname
    });

    return res.send(`${req.protocol}://${req.hostname}/download?filename=${filename}&secret=${secretkey}`);
});

module.exports = app;