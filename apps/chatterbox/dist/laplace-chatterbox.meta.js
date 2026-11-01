// ==UserScript==
// @name         LAPLACE 弹幕助手 - 哔哩哔哩直播间独轮车、弹幕发送
// @namespace    https://greasyfork.org/users/1524935
// @version      4.8.1-liveaudio.1
// @author       laplace-live; live audio fork by hengyoush
// @description  这是 bilibili 直播间简易版独轮车，基于 quiet/thusiant cmd 版本 https://greasyfork.org/scripts/421507 继续维护而来
// @license      AGPL-3.0
// @icon         https://laplace.live/favicon.ico
// @homepageURL  https://laplace.live/chatterbox
// @supportURL   https://github.com/hengyoush/chatterbox
// @downloadURL  https://raw.githubusercontent.com/hengyoush/chatterbox/feat/live-room-audio/apps/chatterbox/dist/laplace-chatterbox.user.js
// @updateURL    https://raw.githubusercontent.com/hengyoush/chatterbox/feat/live-room-audio/apps/chatterbox/dist/laplace-chatterbox.meta.js
// @match        *://live.bilibili.com/*
// @match        *://space.bilibili.com/*
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/opus/*
// @connect      api.deepgram.com
// @connect      open.bigmodel.cn
// @connect      generativelanguage.googleapis.com
// @connect      gateway.ai.cloudflare.com
// @connect      api.typesafe.ai
// @connect      openrouter.ai
// @connect      api.openai.com
// @connect      localhost
// @connect      127.0.0.1
// @connect      *
// @grant        GM_addValueChangeListener
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_info
// @grant        GM_listValues
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==