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

const tasks0 = [
    (callback) => {
        request('http://ncov.mohw.go.kr/bdBoardList_Real.do?brdId=1&brdGubun=11&ncvContSeq=&contSeq=&board_id=&gubun=', (err, res, body) => {
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
        obj.arr = [];
        obj.plus = $("div[class=hdn]").first().find('td').last().text();
        let trs = $(".num").children("tbody").children('tr').children('td');
        for(let i = 4; i < 12; i++) {
            obj.arr.push(
                trs[i].children[0].data.trim()
                .replace(/(\d+)\s*명/, "$1")
            );
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

let makePng = (title, arr, plus) => new Promise((resolve, reject) => {
    const canvas = createCanvas(600, 300);
    const ctx = canvas.getContext('2d');
    
    const t = ["확진자", "의심자", "완치자", "사망자"];
    const n = [3, 6, 1, 2]
    const x = 150;
    
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
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 7;
    ctx.font = "bold 30px 'Jua',sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(plus + "▲", x - 25, 80);
    ctx.textAlign = "left";

    for(let i = 0; i < 4; i++) {
        ctx.font = "30px 'Jua',sans-serif";
        ctx.fillText(t[i], x + 25, 80 + (50 * i));
        ctx.font = "bold 50px 'Jua',sans-serif";
        ctx.fillText(arr[n[i]] + '명', x + 115, 80 + (50 * i));
    }

    ctx.fillRect(x, 45, 5, 190);

    ctx.shadowBlur = 0;
    ctx.baseLine = "bottom";
    ctx.textAlign = "right";
    ctx.font = 'bold 15px Jua,sans-serif';
    ctx.fillText(title, 595, 295);
    ctx.fillText('http://pf.kakao.com/_NBxgxbxb', 595, 275);

    dataUrl = canvas.toDataURL('image/png');
    ImageDataURI.outputFile(
        dataUrl,
        "public/kinfo" + Buffer.from(title.replace(/.+?\((.+?)\)/, "$1"), "utf8")
        .toString('base64')
    )
    .then(result => {
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
                            description: "확진환자: " + output.arr[3] + "명\n격리 해제 조치 확진자: " + output.arr[1] + "명\n사망자: " + output.arr[2] + "명\n검사 진행자: " + output.arr[6] + "명",
                            thumbnail: {
                                imageUrl: "http://15.165.6.4:91/f/kinfo" + Buffer.from(output.title.replace(/.+?\((.+?)\)/, "$1"), "utf8").toString('base64') + ".png",
                                link: { web: "http://15.165.6.4:91/f/kinfo" + Buffer.from(output.title.replace(/.+?\((.+?)\)/, "$1"), "utf8").toString('base64') + ".png" }
                            },
                            buttons: [{
                                action: "share",
                                label: "공유하기"
                            }]
                        }
                    }]
                }
            };
            await makePng(output.title, output.arr, output.plus);
            req.status(200).send(obj);
        }
    });
});

app.post('/daily', (res, req) => {
    async.waterfall(tasks0, (err, output) => {
        if(err) req.status(502).send();
        else {
            let temp = output.title.replace(/.+?\((\d*\.\d*)\..+?\)/, "$1").replace(/\./, "");
            if(temp.length < 4) temp = '0' + temp;
            console.log(temp);
            req.status(200).send({
                version: "2.0",
                template: {
                    outputs: [{
                        carousel: {
                            type: "basicCard",
                            items: [
                                {
                                    title: "일일 확진자 변화 추세",
                                    thumbnail: {
                                        imageUrl: "http://ncov.mohw.go.kr/static/image/main_chart/live_pdata1_mini_" + temp + ".png",
                                        link: { web: "http://ncov.mohw.go.kr/static/image/main_chart/live_pdata1_mini_" + temp + ".png" }
                                    },
                                    buttons: [{
                                        action: "share",
                                        label: "공유하기"
                                    }]
                                },
                                {
                                    title: "일일 완치자 변화 추세",
                                    thumbnail: {
                                        imageUrl: "http://ncov.mohw.go.kr/static/image/main_chart/live_pdata2_mini_" + temp + ".png",
                                        link: { web: "http://ncov.mohw.go.kr/static/image/main_chart/live_pdata2_mini_" + temp + ".png" }
                                    },
                                    buttons: [{
                                        action: "share",
                                        label: "공유하기"
                                    }]
                                }
                            ]
                        }
                    }]
                }
            });
        }
    })
})

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