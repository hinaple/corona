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

function findMax(arr) {
    let temp = arr[0].data;
    for(let i = 0; i < arr.length; i++) if(temp < arr[i].data) temp = arr[i].data;
    return temp;
}

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

const tasks2 = [
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

const tasks3 = [
    tasks0[0],
    (body, callback) => {
        const $ = cheerio.load(body);
        let obj = { title: $(".s_descript")[0].children[0].data, arr0: [], arr1: [] };
        $("div[class=hdn]").first().find('td').each((i, item) => {
            if(i % 3 == 0) obj.arr0.push({ title: Number($(item).text().replace(/\d{4}\d{2}(\d{2})/, "$1")) });
            else if(i % 3 == 2) obj.arr0[Math.floor(i / 3)].data = Number($(item).text().trim());
        });
        $("div[class=hdn]").last().find('td').each((i, item) => {
            if(i % 3 == 0) obj.arr1.push({ title: Number($(item).text().replace(/\d{4}\d{2}(\d{2})/, "$1")) });
            else if(i % 3 == 2) obj.arr1[Math.floor(i / 3)].data = Number($(item).text().trim());
        });
        callback(null, obj);
    }
]

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
    ctx.fillText(plus + "▲", x - 10, 80);
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

let makeGraph = (arr, fm) => new Promise((resolve, reject) => {
    const x = 560;
    const y = 400;
    const t = 30;
    const max = findMax(arr);
    const ymax = Math.floor((max + 100) / 100) * 100;
    const ycell = y / ymax;
    const xcell = x / (arr.length + 1);

    const canvas = createCanvas(x + (2 * t), y + (2 * t));
    const ctx = canvas.getContext('2d');

    let grd = ctx.createLinearGradient(0, 0, x + (2 * t), y + (2 * t));
    grd.addColorStop(1, "#b34f93");
    grd.addColorStop(0, "#640064");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, x + (2 * t), y + (2 * t));
    grd = ctx.createLinearGradient(0, 0, x + (2 * t), y + (2 * t));
    grd.addColorStop(0, "#ff00ff");
    grd.addColorStop(1, "#ff7575");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(550, 300, 350, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 7;
    ctx.font = "bold 20px Jua,sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";

    ctx.beginPath();
    ctx.moveTo(t, t);
    ctx.lineTo(t, y + t);
    ctx.lineTo(x + t, y + t);
    ctx.stroke();

    ctx.fillText(ymax + "(명)", t - 20, t - 10);
    ctx.fillText(0, t / 2, y + (2 * t) - 10);

    ctx.textAlign = "center";
    ctx.lineWidth = 10;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(xcell + t, (ymax - arr[0].data) * ycell + t);
    for(let i = 1; i < arr.length; i++) {
        ctx.lineTo(xcell * (i + 1) + t, (ymax - arr[i].data) * ycell + t);
    }
    ctx.stroke();
    
    ctx.fillStyle = "#2b014a";
    for(let i = 0; i < arr.length; i++) {
        ctx.beginPath();
        ctx.arc(xcell * (i + 1) + t, (ymax - arr[i].data) * ycell + t, 10, 0, 2 * Math.PI);
        ctx.fill();
    }

    ctx.shadowColor = "#000";
    ctx.fillStyle = "#fff";
    ctx.shadowBlur = 5;
    for(let i = 0; i < arr.length; i++) {
        ctx.fillText(arr[i].data, xcell * (i + 1) + t, (ymax - arr[i].data) * ycell + t - 15);
        ctx.fillText(arr[i].title, xcell * (i + 1) + t, y + t + 20);
    }

    dataUrl = canvas.toDataURL('image/png');
    ImageDataURI.outputFile(dataUrl, "public/" + fm).then(() => {
        resolve();
    })
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
    async.waterfall(tasks3, async (err, output) => {
        if(err) req.status(502).send();
        else {
            let fmt = Buffer.from(
                output.title.replace(/.+?\((.+?)\)/, "$1"),
                "utf8"
            ).toString('base64');
            await makeGraph(output.arr0, "graph0" + fmt);
            await makeGraph(output.arr1, "graph1" + fmt)
            req.status(200).send({
                version: "2.0",
                template: {
                    outputs: [{
                        carousel: {
                            type: "basicCard",
                            items: [
                                {
                                    title: "일일 확진자 변화 추세",
                                    description: "사진을 눌러서 크게 보기",
                                    thumbnail: {
                                        imageUrl: "http://15.165.6.4:91/f/" + "graph0" + fmt + ".png",
                                        link: { web: "http://15.165.6.4:91/f/" + "graph0" + fmt + ".png" }
                                    },
                                    buttons: [{
                                        action: "share",
                                        label: "공유하기"
                                    }]
                                },
                                {
                                    title: "일일 완치자 변화 추세",
                                    description: "사진을 눌러서 크게 보기",
                                    thumbnail: {
                                        imageUrl: "http://15.165.6.4:91/f/" + "graph1" + fmt + ".png",
                                        link: { web: "http://15.165.6.4:91/f/" + "graph1" + fmt + ".png" }
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
    async.waterfall(tasks2, (err, output) => {
        if(err) req.status(502).send();
        else {
            req.status(200).send(output);
        }
    });
});

app.listen(91, () => {
    console.log("server is running on port 91");
})