const request = require('request');
const express = require('express');
const app = express();
const logger = require('morgan');
const async = require('async');
const cheerio = require('cheerio');
require('events').EventEmitter.defaultMaxListeners = 15;

const NAVER_ID = "FOR_GITHUB";
const NAVER_PW = "FOR_GITHUB";

const newsOpt = {
    uri: "https://openapi.naver.com/v1/search/news.json",
    qs: {
        query: "폐렴 확진자",
        display: 5,
        start: 1,
        sort: "date"
    },
    headers: {
        "X-Naver-Client-Id": NAVER_ID,
        "X-Naver-Client-Secret": NAVER_PW
    }
};

/*let shourl = str => new Promise((resolve, reject) => {
    request.post({
        url: 'https://openapi.naver.com/v1/util/shorturl.json',
        method: 'POST',
        headers: {
            "X-Naver-Client-Id": NAVER_ID,
            "X-Naver-Client-Secret": NAVER_PW
        },
        form: { url: str }
    }, (err, res, result) => {
        if(err) resolve(str);
        else resolve(JSON.parse(result).result.url);
    });
});*/ //채팅 유형이 바뀌면서 단축 url의 필요성 저하(3번째 커밋부터 삭제될 예정)

const tasks0 = [
    (callback) => {
        request('http://ncov.mohw.go.kr/bdBoardList_Real.do?brdId=&brdGubun=&ncvContSeq=&contSeq=&board_id=&gubun=', (err, res, body) => {
            if(err) {
                callback(err);
                console.log(err);
            }
            else callback(null, body);
        });
    },
    (body, callback) => {
        let obj = {};
        const $ = cheerio.load(body);
        obj.title = $(".s_descript")[0].children[0].data;
        let trs = $(".num").children("tbody").children('tr').children('td');
        for(let i = 0; i < 4; i++) {
            obj[i.toString()] = trs[i].children[0].data.trim().replace(/\,/g, "").replace(/(\d+)\s*명/, "$1");
        }
        callback(null, obj);
    }
];

const tasks1 = [
    (callback) => {
        request('http://ncov.mohw.go.kr/bdBoardList_Real.do?brdId=1&brdGubun=14&ncvContSeq=&contSeq=&board_id=&gubun=', (err, res, body) => {
            if(err) {
                callback(err);
                console.log(err);
            }
            else callback(null, body);
        });
    },
    (body, callback) => {
        let obj = {};
        const $ = cheerio.load(body);
        let trs = $(".num").children("tbody").children('tr').children('td');
        let temp = null;
        for(let i = 0; i < 346; i++) {
            if(i % 2 == 0) temp = trs[i].children[0].data.trim();
            else obj[temp] = trs[i].children[0].data.trim().replace(/\,/g, "").replace(/(\d+)\s*명\s*(?:\(.+\))?/, "$1");
        }
        let str = "";
        let etc = 0;
        for(let c in obj) {
            if(c == "title") continue;
            else if(Number(obj[c]) < 501) {
                etc += Number(obj[c]);
                continue;
            }
            str += c + ": " + obj[c] + "명\n";
        }
        obj.total = (str + "기타: " + etc + "명").trim();
        callback(null, obj);
    }
];

const head = ["감염자", "사망자", "사망률"];

const tasks3 = [
    tasks1[0],
    (body, callback) => {
        let arr = [];
        const $ = cheerio.load(body);
        let trs = $(".data_table.mgt8").children(".num").children("tbody").children('tr').children('th, td');
        for(let i = 0; i < 24; i++) {
            if(i % 4 == 0) arr.push({ ctr: trs[i].children[0].data.trim(), arr: [] });
            else arr[Math.floor(i / 4)].arr.push(trs[i].children[0].data.trim().replace(/\,/g, ""));
        }
        let str = "";
        for(let i = 0; i < arr.length; i++) {
            str += arr[i].ctr + "\n";
            for(let j = 0; j < arr[i].arr.length; j++) {
                str += head[j] + ": " + arr[i].arr[j] + "\n";
            }
            str += "\n";
        }
        callback(null, { text: str.trim() });
    }
];

app.use(logger('dev', {}));

app.post('/corona', (res, req) => {
    async.waterfall(tasks0, (err, output) => {
        if(err) req.status(502).send();
        else {
            req.status(200).send(output);
        }
    });
});

app.post('/world', (res, req) => {
    async.waterfall(tasks1, (err, output) => {
        if(err) req.status(502).send();
        else {
            req.status(200).send(output);
        }
    });
});

app.post('/news', (res, req) => {
    request(newsOpt, async (err, response, data) => {
        if(err) req.status(502).send();
        else {
            data = JSON.parse(data);
            let temp = {
                version: "2.0",
                template: {
                    outputs: [{
                        listCard: {
                            header: { 
                                title: "Corona News",
                                imageUrl: "https://i.ibb.co/TPnpmqC/news.jpg"
                            },
                            items: [],
                            buttons: [{
                                label: "공유하기",
                                action: "share"
                            }]
                        }
                    }]
                }
            }
            for(let i = 0; i < data.items.length; i++) {
                temp.template.outputs[0].listCard.items.push({
                    title: data.items[i].title.replace(/\<.+?\>|\&.+?\;/g, ""),
                    link: { web: data.items[i].link },
                    description: data.items[i].description.replace(/\<.+?\>|\&.+?\;/g, "")
                });
            }
            req.status(200).send(temp);
        }
    });
});

app.post('/center', (res, req) => {
    async.waterfall(tasks3, (err, output) => {
        if(err) req.status(502).send();
        else {
            req.status(200).send(output);
        }
    });
});

app.listen(91, () => {
    console.log("server is running on port 91");
})