const request = require('request');
const express = require('express');
const app = express();
const logger = require('morgan');
const async = require('async');
const cheerio = require('cheerio');
require('events').EventEmitter.defaultMaxListeners = 15;

const NAVER_ID = "FOR GITHUB";
const NAVER_PW = "FOR GITHUB";

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

let shourl = str => new Promise((resolve, reject) => {
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
});

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
        let trs = $(".num").children("tbody").children('tr').children('th, td');
        let temp = null;
        for(let i = 0; i < 8; i++) {
            if(i % 2 == 0) temp = trs[i].children[0].data.trim();
            else obj[temp] = trs[i].children[0].data.trim().replace(/\,/g, "").replace(/(\d+)\s*명/, "$1");
        }
        callback(null, obj);
    }
];

const tasks1 = [
    tasks0[0],
    (body, callback) => {
        let obj = {};
        const $ = cheerio.load(body);
        let trs = $(".num").children("tbody").children('tr').children('td');
        obj.title = $(".s_descript")[1].children[0].data;
        obj.한국 = trs[0].children[0].data.trim().replace(/\,/g, "").replace(/(\d+)\s*명/, "$1")
        let temp = null;
        for(let i = 4; i < trs.length; i++) {
            if(i % 2 == 0) temp = trs[i].children[0].data.trim();
            else obj[temp] = trs[i].children[0].data.trim().replace(/\,/g, "").replace(/(\d+)\s*명\s*(?:\(.+\))?/, "$1");
        }
        let str = obj.title + "\n\n";
        for(let c in obj) {
            if(c == "title") continue;
            str += c + ": " + obj[c] + "명\n";
        }
        obj.total = str.trim();
        callback(null, obj);
    }
];

//개발 예정
/*const tasks2 = [
    (callback) => {
        request('https://wuhanvirus.kr/', (err, res, body) => {
            if(err) callback(err);
            else callback(null, body);
        });
    },
    (body, callback) => {
        const $ = cheerio.load(body);
        callback(null, $('#korea-table').find('tr').each((index, elem) => {
            console.log(1);
            $(this).find('td').each((index1, elem1) => {
                console.log($(this).text);
            });
        }));
    },
    (data, callback) => {
        callback(null, data);
    }
];*/

app.use(logger('dev', {}));

app.post('/corona', (res, req) => {
    async.waterfall(tasks0, (err, output) => {
        if(err) req.status(502).send();
        else {
            req.status(200).send(output);
        }
    });
});

app.post('/asia', (res, req) => {
    async.waterfall(tasks1, (err, output) => {
        if(err) req.status(502).send();
        else {
            output.cnp = String(Math.round(Number(output.중국) / 1386000000 * 100000000) / 1000000);
            output.krp = String(Math.round(Number(output.한국) / 51470000 * 100000000) / 1000000);
            output.jpp = String(Math.round(Number(output.일본) / 126800000 * 100000000) / 1000000);
            req.status(200).send(output);
        }
    });
});

app.post('/news', (res, req) => {
    request(newsOpt, async (err, response, data) => {
        if(err) req.status(502).send();
        else {
            data = JSON.parse(data);
            for(let i = 0; i < data.items.length; i++) {
                data['title' + i] = data.items[i].title.replace(/\<.+?\>|\&.+?\;/g, "");
                data['link' + i] = await shourl(data.items[i].link);
            }
            req.status(200).send(data);
        }
    });
});

//개발 예정
/*app.post('/locate', (res, req) => {
    async.waterfall(tasks2, (err, output) => {
        req.status(200).send("1");
    })
})*/

app.listen(91, () => {
    console.log("server is running on port 91");
})