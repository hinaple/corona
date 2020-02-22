const request = require('request');
const express = require('express');
const app = express();
const logger = require('morgan');
const async = require('async');
const cheerio = require('cheerio');

const tasks = [
    (callback) => {
        request('http://ncov.mohw.go.kr/bdBoardList.do', (err, res, body) => {
            if(err) callback(err);
            callback(null, body);
        });
    },
    (body, callback) => {
        const $ = cheerio.load(body);
        callback(null, [$(".s_listin_dot").children("li"), $(".s_descript")]);
    },
    (info, callback) => {
        let obj = {};
        obj.title = info[1][0].children[0].data;
        for(let i = 0; i < 4; i++) {
            obj[info[0][i].children[0].data.replace(/\((.+?)\)\s(?:.+)명/, "$1").replace(/\s/g, "")] = info[0][i].children[0].data.replace(/\((?:.+?)\)\s(.+)명/, "$1")
        }
        callback(null, obj);
    }
];

app.use(logger('dev', {}));

app.post('/corona', (res, req) => {
    async.waterfall(tasks, (err, output) => {
        if(err) req.status(502).send({ text: "예상치 못한 오류로 인해 정보 제공이 지연되고 있습니다.\n잠시 후 다시 시도해주십시오." });
        else {
            req.status(200).send(output);
        }
    });
});

app.listen(91, () => {
    console.log("server is running on port 91");
})