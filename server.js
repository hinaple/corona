const request = require('request');
const express = require('express');
const app = express();
const logger = require('morgan');
const async = require('async');
const cheerio = require('cheerio');

const tasks0 = [
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
            obj[
                info[0][i]
                .children[0]
                .data
                .replace(/\((.+?)\)\s(?:.+)명/, "$1")
                .replace(/\s/g, "")
            ]
            = info[0][i]
            .children[0]
            .data
            .replace(/\((?:.+?)\)\s(.+)명/, "$1")
            .replace(/\,/g, "");
        }
        callback(null, obj);
    }
];

const tasks1 = [
    tasks0[0],
    tasks0[1],
    (info, callback) => {
        let obj = {};
        obj.title = info[1][1].children[0].data;
        //Korea
        obj.kr = info[0][0]
        .children[0]
        .data
        .replace(/\((?:.+?)\)\s(.+)명/, "$1")
        .replace(/\,/g, "");
        //China
        obj.cn = info[0][4]
        .children[0]
        .data
        .replace(/\(중국\)\s(.+)명.+/, "$1")
        .replace(/\,/g, "");
        //Japan
        obj.jp = info[0][5]
        .children[0]
        .data
        .replace(/.+?일본\s(.+?)명.+/, "$1")
        .replace(/\,/g, "");
        callback(null, obj);
    }
];

app.use(logger('dev', {}));

app.post('/corona', (res, req) => {
    async.waterfall(tasks0, (err, output) => {
        if(err) req.status(502).send({ text: "예상치 못한 오류로 인해 정보 제공이 지연되고 있습니다.\n잠시 후 다시 시도해주십시오." });
        else {
            req.status(200).send(output);
        }
    });
});

app.post('/asia', (res, req) => {
    async.waterfall(tasks1, (err, output) => {
        if(err) req.status(502).send({ text: "예상치 못한 오류로 인해 정보 제공이 지연되고 있습니다.\n잠시 후 다시 시도해주십시오." });
        else {
            output.cnp = String(Math.round(Number(output.cn) / 1386000000 * 100000000) / 1000000);
            output.krp = String(Math.round(Number(output.kr) / 51470000 * 100000000) / 1000000);
            output.jpp = String(Math.round(Number(output.jp) / 126800000 * 100000000) / 1000000);
            req.status(200).send(output);
        }
    });
});

app.listen(91, () => {
    console.log("server is running on port 91");
})