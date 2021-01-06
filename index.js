const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const showdown = require('showdown');
const sanitizeHtml = require('sanitize-html');
const bunyan = require('bunyan');

const termPage = fs.readFileSync(path.join(__dirname + '/frontend/term.html'), 'utf8');
const notFoundPage = fs.readFileSync(path.join(__dirname + '/frontend/404.html'), 'utf8');
const indexPage = fs.readFileSync(path.join(__dirname + '/frontend/index.html'), 'utf8');

const axinst = axios.create({
    validateStatus: (s) => s < 500,
    baseURL: 'https://termora.starshines.xyz/api/v1'
});

const log = bunyan.createLogger({
    name: 'berry-site',
    streams: [
        {
            level: 'info',
            stream: process.stdout            // log INFO and above to stdout
        },
        {
            level: 'error',
            path: 'error.log'  // log ERROR and above to a file
        }
    ]
});

const app = express();
const converter = new showdown.Converter({
    strikethrough: true,
    simpleLineBreaks: true,
    underline: true,
    simplifiedAutoLink: true,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function getRoot(_, res) {
    let list = (await axinst('/list')).data;
    log.debug({ msg: "got terms", count: list.len });
    list = list.map(t => {
        return `<li><a href="/term/${encodeURI(t.name.toLowerCase())}">${t.name}</a> (${t.aliases.join(', ') || 'no aliases'})</li>`
    }).join("\n")
    res.send(indexPage.replace('$LIST', list));
    log.info({ path: "/" }, "served list of terms");
}

async function getTerm(req, res) {
    let termP = termPage;
    let terms = (await axinst('/list')).data;
    let termName = decodeURI(req.params.term.toLowerCase());
    let term;
    terms.forEach(t => {
        if (t.name.toLowerCase() == termName) {
            term = t;
        } else if (t.aliases.map(a => a.toLowerCase()).includes(termName)) {
            term = t;
        }
    });

    try {
        termP = termP.replace('$TERM_NAME', term.name);
        termP = termP.replace('$TERM_NAME', term.name);
        termP = termP.replace('$TERM_ALIASES', term.aliases.join(', ') || 'None');
        termP = termP.replace('$DESCRIPTION', converter.makeHtml(term.description));
        termP = termP.replace('$SOURCE', converter.makeHtml(term.source));
        termP = termP.replace('$ID', term.id);
        termP = termP.replace('$CATEGORY', term.category);
        termP = termP.replace('$CATEGORY_ID', term.category_id);
        termP = termP.replace('$CREATED', new Date(term.created).toDateString());
        res.send(termP);
        log.info({ path: "/term/", term: termName, found: term.name }, "term found");
    } catch (e) {
        res.send(notFoundPage.replace('$TERM_NAME', sanitizeHtml(termName)));
        log.info({ path: "/term/", term: termName, found: false }, "term not found");
    }
}

app.get("/", getRoot);
app.get("/term/:term", getTerm);
app.use(express.static(path.join(__dirname, '/frontend/')));

const port = process.env.PORT || 8080;
app.listen(port);
log.info(`Server running on port ${port}`);