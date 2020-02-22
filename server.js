const request = require('request');
const express = require('express');
const app = express();
const logger = require('morgan');
const async = require('async');

const tasks = [
    (callback) => {
        request('http://ncov.mohw.go.kr/bdBoardList.do', (err, res, body) => {
            callback(null, body);
        });
    },
    (body, callback) => {
        const $ = cheerio.load(body);
        console.log($(".s_listin_dot")[0]);
    }
]

app.use(logger('simple', {}));

app.post('corona', (res, req) => {

});