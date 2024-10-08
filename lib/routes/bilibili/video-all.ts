import { Route } from '@/types';
import got from '@/utils/got';
import cache from './cache';
import utils from './utils';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/user/video-all/:uid/:embed?',
    name: '用户所有视频',
    maintainers: [],
    handler,
    example: '/bilibili/user/video-all/2267573',
    parameters: {
        uid: '用户 id, 可在 UP 主主页中找到',
        embed: '默认为开启内嵌视频, 任意值为关闭',
    },
    categories: ['social-media'],
};

async function handler(ctx) {
    const uid = ctx.req.param('uid');
    const embed = !ctx.req.param('embed');
    const cookie = await cache.getCookie();
    const wbiVerifyString = await cache.getWbiVerifyString();
    const dmImgList = utils.getDmImgList();
    const [name, face] = await cache.getUsernameAndFaceFromUID(uid);

    await got(`https://space.bilibili.com/${uid}/video?tid=0&page=1&keyword=&order=pubdate`, {
        headers: {
            Referer: `https://space.bilibili.com/${uid}/`,
            Cookie: cookie,
        },
    });
    const params = utils.addWbiVerifyInfo(utils.addDmVerifyInfo(`mid=${uid}&ps=30&tid=0&pn=1&keyword=&order=pubdate&platform=web&web_location=1550101&order_avoided=true`, dmImgList), wbiVerifyString);
    const response = await got(`https://api.bilibili.com/x/space/wbi/arc/search?${params}`, {
        headers: {
            Referer: `https://space.bilibili.com/${uid}/video?tid=0&page=1&keyword=&order=pubdate`,
            Cookie: cookie,
        },
    });

    const vlist = [...response.data.data.list.vlist];
    const pageTotal = Math.ceil(response.data.data.page.count / response.data.data.page.ps);

    const getPage = async (pageId) => {
        const cookie = await cache.getCookie();
        await got(`https://space.bilibili.com/${uid}/video?tid=0&page=${pageId}&keyword=&order=pubdate`, {
            headers: {
                Referer: `https://space.bilibili.com/${uid}/`,
                Cookie: cookie,
            },
        });
        const params = utils.addWbiVerifyInfo(utils.addDmVerifyInfo(`mid=${uid}&ps=30&tid=0&pn=${pageId}&keyword=&order=pubdate&platform=web&web_location=1550101&order_avoided=true`, dmImgList), wbiVerifyString);
        return got(`https://api.bilibili.com/x/space/wbi/arc/search?${params}`, {
            headers: {
                Referer: `https://space.bilibili.com/${uid}/video?tid=0&page=${pageId}&keyword=&order=pubdate`,
                Cookie: cookie,
            },
        });
    };

    const promises = [];

    if (pageTotal > 1) {
        for (let i = 2; i <= pageTotal; i++) {
            promises.push(getPage(i));
        }
        const rets = await Promise.all(promises);
        for (const ret of rets) {
            vlist.push(...ret.data.data.list.vlist);
        }
    }

    return {
        title: name,
        link: `https://space.bilibili.com/${uid}/video`,
        description: `${name} 的 bilibili 所有视频`,
        logo: face,
        icon: face,
        item: vlist.map((item) => ({
            title: item.title,
            description: utils.renderUGCDescription(embed, item.pic, item.description, item.aid, undefined, item.bvid),
            pubDate: parseDate(item.created, 'X'),
            link: item.created > utils.bvidTime && item.bvid ? `https://www.bilibili.com/video/${item.bvid}` : `https://www.bilibili.com/video/av${item.aid}`,
            author: name,
            comments: item.comment,
        })),
    };
}
