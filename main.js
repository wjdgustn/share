// 기본 모듈
const express = require('express');
const http = require('http');
const https = require('https');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const redis = require('redis');
const RedisStore = require('connect-redis')(session);
const fs = require('fs');
const path = require('path');

const File = require('./schemas/file');

// 설정 파일, 유틸
const setting = require('./setting.json');

if(!fs.existsSync(setting.SAVE_FILE_PATH)) {
    console.log('파일 저장 경로가 잘못되었습니다. 프로그램을 종료합니다.');
    process.exit(0);
}

// app 정의
const app = express();

// 몽고디비 스키마 연결
const connect = require('./schemas');
connect();

// SSL 관련 설정
let options;
if(setting.USE_SSL) {
    options = {
        cert: fs.readFileSync(setting.SSL_CERT),
        key: fs.readFileSync(setting.SSL_KEY)
    }
}

// 세션, REDIS
if(setting.USE_REDIS) {
    const client = redis.createClient({
        host: setting.REDIS_HOST,
        port: setting.REDIS_PORT,
        password: setting.REDIS_PASSWORD,
        logError: true
    })

    app.use(session({
        secret: setting.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: new RedisStore({ client: client })
    }));
}
else {
    app.use(session({
        secret: setting.SESSION_SECRET,
        resave: false,
        saveUninitialized: false
    }));
}

// 쿠키 파서
app.use(cookieParser());

// Flash 설정
app.use(flash());

// 정적 파일 제공
const staticoptions = {
    index: setting.INDEX
}
app.use(express.static(__dirname + "/public/", staticoptions));

// view engine을 EJS로 설정
app.set('views', './views');
app.set('view engine', 'ejs');

// 미리 템플릿 엔진 변수 넣기
app.use((req, res, next) => {
    res.locals.servername = setting.SERVER_NAME;
    res.locals.Error = req.flash('Error');
    res.locals.Info = req.flash('Info');
    res.locals.Warn = req.flash('Warn');
    if(setting.TRUST_IP_HEADER) res.locals.ip = req.get('x-forwarded-for').replace('::ffff:', '');
    else res.locals.ip = req.connection.remoteAddress.replace('::ffff:', '');
    next();
});

// 라우터 불러오기
console.log('라우터를 불러오는 중...');
fs.readdirSync('./routes').forEach((file) => {
    app.use(require(`./routes/${file}`));
    console.log(`${file} 라우터를 불러왔습니다.`);
});
console.log('라우터를 모두 불러왔습니다.\n');

// 서버 구동
let server;
if(setting.USE_SSL) {
    server = https.createServer(options, app).listen(setting.PORT, () => {
        console.log('보안 서버가 구동중입니다!');
    });
}
else {
    server = http.createServer(app).listen(setting.PORT, () => {
        console.log("서버가 구동중입니다!");
    });
}

setImmediate(async () => {
    const file = await File.find({
        limit: { $lte : new Date().getTime() }
    });
    file.forEach(f => {
        fs.unlinkSync(path.join(setting.SAVE_FILE_PATH, f.filename));
    });
    await File.deleteMany({
        limit: { $lte : new Date().getTime() }
    });
});
setInterval(async () => {
    const file = await File.find({
        limit: { $lte : new Date().getTime() }
    });
    file.forEach(f => {
        fs.unlinkSync(path.join(setting.SAVE_FILE_PATH, f.filename));
    });
    await File.deleteMany({
        limit: { $lte : new Date().getTime() }
    });
}, 60000);