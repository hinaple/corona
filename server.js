const request = require('request');
const express = require('express');
const app = express();
const logger = require('morgan');
const async = require('async');
const cheerio = require('cheerio');
const { createCanvas } = require('canvas');
const ImageDataURI = require('image-data-uri');

require('events').EventEmitter.defaultMaxListeners = 15;

const NAVER_ID = "FOT_GITHUB";
const NAVER_PW = "FOT_GITHUB";

app.use("/f", express.static("public"));

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

let makePng = (title, info0, info1, info2, info3) => new Promise((resolve, reject) => {
    const canvas = createCanvas(600, 300);
    const ctx = canvas.getContext('2d');
    
    let grd = ctx.createLinearGradient(0, 0, 600, 300);
    grd.addColorStop(1, "#b34f93");
    grd.addColorStop(0, "#640064");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 600, 300);
    grd = ctx.createLinearGradient(0, 0, 600, 300);
    grd.addColorStop(0, "#ff00ff");
    grd.addColorStop(1, "#ff7575");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(550, 200, 250, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "30px Jua,sans-serif";
    ctx.textAlign = "left";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 7;
    ctx.fillText('확진자', 110, 80);
    ctx.font = "bold 50px 'Jua',sans-serif";
    ctx.fillText(info0 + '명', 200, 80);
    
    ctx.font = "30px 'Jua',sans-serif";
    ctx.fillText('완치자', 110, 130);
    ctx.font = "bold 50px 'Jua',sans-serif";
    ctx.fillText(info1 + '명', 200, 130);

    ctx.font = "30px 'Jua',sans-serif";
    ctx.fillText('사망자', 110, 180);
    ctx.font = "bold 50px 'Jua',sans-serif";
    ctx.fillText(info2 + '명', 200, 180);

    ctx.font = "30px 'Jua',sans-serif";
    ctx.fillText('의심자', 110, 230);
    ctx.font = "bold 50px 'Jua',sans-serif";
    ctx.fillText(info3 + '명', 200, 230);

    ctx.fillRect(85, 45, 5, 190);

    ctx.shadowBlur = 0;
    ctx.baseLine = "bottom";
    ctx.textAlign = "right";
    ctx.font = 'bold 15px Jua,sans-serif';
    ctx.fillText(title, 595, 295);
    ctx.fillText('http://pf.kakao.com/_NBxgxbxb', 595, 275);

    dataUrl = canvas.toDataURL('image/png');
    ImageDataURI.outputFile(dataUrl, "public/koreainfo").then(result => {
        resolve();
    });
});

app.use(logger('dev', {}));

app.post('/corona', (res, req) => {
    async.waterfall(tasks0, async (err, output) => {
        if(err) req.status(502).send();
        else {
            let obj = {
                version: "2.0",
                template: {
                    outputs: [{
                        basicCard: {
                            title: output.title,
                            description: "확진환자: " + output["0"] + "명\n격리 해제 조치 확진자: " + output["1"] + "명\n사망자: " + output["3"] + "명\n검사 진행자: " + output["2"] + "명",
                            thumbnail: {
                                imageUrl: "http://15.165.6.4:91/f/koreainfo.png",
                                link: { web: "http://15.165.6.4:91/f/koreainfo.png" }
                            },
                            buttons: [{
                                action: "share",
                                label: "공유하기"
                            }]
                        }
                    }]
                }
            };
            await makePng(output.title, output["0"], output["1"], output["3"], output["2"]);
            req.status(200).send(obj);
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
    request(newsOpt, (err, response, data) => {
        if(err) req.status(502).send();
        else {
            data = JSON.parse(data);
            let temp = {
                version: "2.0",
                template: {
                    outputs: [{
                        listCard: {
                            header: { 
                                title: "코로나 관련 뉴스",
                                imageUrl: "http://15.165.6.4:91/f/news.jpg"
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